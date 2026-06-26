import os
import easyocr

# Initialize the reader (downloads the model on first run)
reader = easyocr.Reader(['en'])

# Path to your folder containing the screenshots
screenshot_folder = "./questions"
output_file = "extracted_questions.md"

with open(output_file, "w", encoding="utf-8") as f:
    f.write("# Extracted Interview Questions\n\n")
    
    # Loop through and sort files to keep them in order
    for filename in sorted(os.listdir(screenshot_folder)):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            img_path = os.path.join(screenshot_folder, filename)
            print(f"Processing: {filename}...")
            
            # Extract text
            result = reader.readtext(img_path, detail=0)
            
            # Write to file
            f.write(f"## From {filename}\n")
            f.write("\n".join(result))
            f.write("\n\n---\n\n")

print(f"Done! All questions saved to {output_file}")