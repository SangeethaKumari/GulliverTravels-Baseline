import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

from dotenv import load_dotenv
load_dotenv()

from google.adk.runners import InMemoryRunner
from google.genai import types

from travelagent.subagents.glossary_worker import worker_agent, get_generation_prompt, get_revision_prompt
from travelagent.subagents.glossary_evaluator import evaluator_agent, get_evaluation_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("glossary_orchestrator")

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_PATH = os.path.join(BASE_DIR, "data", "glossary.json")
MD_DIR = os.path.join(BASE_DIR, "data", "markdown")

# Ensure markdown output directory exists
os.makedirs(MD_DIR, exist_ok=True)

# Shared memory/in-memory logs for the UI to query live progress
live_logs: List[Dict[str, Any]] = []
current_generating_term: Optional[str] = None
is_generation_active: bool = False

def log_event(term: str, event_type: str, message: str, details: Any = None):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "term": term,
        "type": event_type,  # "worker_draft", "evaluator_critique", "system_status"
        "message": message,
        "details": details
    }
    live_logs.append(log_entry)
    # Keep logs to a reasonable limit
    if len(live_logs) > 300:
        live_logs.pop(0)
    logger.info(f"[{term}] {message}")

def get_safe_filename(term: str) -> str:
    safe = re.sub(r"[^\w\s-]", "", term)
    safe = re.sub(r"[\s-]+", "_", safe)
    return safe.lower()

def extract_section(text: str, tag: str) -> str:
    pattern = rf"<{tag}>(.*?)</{tag}>"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""

def parse_draft(draft_text: str) -> Dict[str, str]:
    sections = {
        "definition": extract_section(draft_text, "definition"),
        "architecture": extract_section(draft_text, "architecture"),
        "examples": extract_section(draft_text, "examples"),
        "advantages": extract_section(draft_text, "advantages"),
        "limitations": extract_section(draft_text, "limitations"),
        "related_concepts": extract_section(draft_text, "related_concepts")
    }
    # Fallback: if tags are missing, put the whole text in definition
    if not sections["definition"]:
        sections["definition"] = draft_text
    return sections

def parse_evaluation(response_text: str) -> Dict[str, Any]:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n```$", "", cleaned)
    cleaned = cleaned.strip()
    try:
        data = json.loads(cleaned)
        if "score" not in data:
            data["score"] = 70
        if "critique" not in data:
            data["critique"] = {}
        if "suggestions" not in data:
            data["suggestions"] = []
        return data
    except Exception as e:
        logger.error(f"Failed to parse evaluator JSON: {e}. Raw response: {response_text}")
        score_match = re.search(r'"score"\s*:\s*(\d+)', cleaned)
        score = int(score_match.group(1)) if score_match else 70
        return {
            "score": score,
            "critique": {"error": "Failed to parse structured JSON critique. Review raw output."},
            "suggestions": ["Refine overall structure and definition formatting."]
        }

def save_markdown_file(term: str, sections: Dict[str, str], score: int):
    filename = f"{get_safe_filename(term)}.md"
    filepath = os.path.join(MD_DIR, filename)
    
    md_content = f"""# {term}

> **Evaluation Score:** {score}/100

## Definition
{sections.get('definition', 'Pending')}

## Architecture & Core Mechanics
{sections.get('architecture', 'Pending')}

## Examples
{sections.get('examples', 'Pending')}

## Advantages
{sections.get('advantages', 'Pending')}

## Limitations
{sections.get('limitations', 'Pending')}

## Related Concepts
{sections.get('related_concepts', 'Pending')}
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md_content)
    logger.info(f"Saved markdown glossary for {term} to {filepath}")

def run_agent_execution(agent: Any, prompt_text: str, session_id: str) -> str:
    runner = InMemoryRunner(agent=agent)
    runner.auto_create_session = True
    new_message = types.Content(role="user", parts=[types.Part(text=prompt_text)])
    
    # Run the agent in ADK
    events = runner.run(
        user_id="glossary_orchestrator",
        session_id=session_id,
        new_message=new_message
    )
    
    response_text = ""
    for event in events:
        if hasattr(event, 'content') and event.content:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text
    return response_text

def generate_term_glossary(term_name: str, max_iterations: int = 4) -> Dict[str, Any]:
    global current_generating_term
    current_generating_term = term_name
    
    # 1. Load glossary DB
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
        
    with open(DB_PATH, "r") as f:
        db = json.load(f)
        
    terms_list = db["terms"]
    term_entry = None
    for entry in terms_list:
        if entry["term"].lower() == term_name.lower():
            term_entry = entry
            break
            
    if not term_entry:
        raise ValueError(f"Term '{term_name}' not found in database.")
        
    term_entry["status"] = "generating"
    with open(DB_PATH, "w") as f:
        json.dump(db, f, indent=2)
        
    log_event(term_name, "system_status", f"Starting generation loop for '{term_name}'. Max iterations: {max_iterations}")
    
    history = []
    best_score = -1
    best_sections = None
    best_draft = ""
    
    # Sessions are isolated per-term to avoid history leaking from other terms
    worker_session = f"worker_{get_safe_filename(term_name)}"
    
    for iteration in range(1, max_iterations + 1):
        log_event(term_name, "system_status", f"--- Iteration {iteration} ---")
        
        # Step A: Worker Agent Generation or Revision
        if iteration == 1:
            prompt = get_generation_prompt(term_name)
            log_event(term_name, "worker_draft", "Worker generating initial Wikipedia-style draft...")
        else:
            last_eval = history[-1]["evaluation"]
            critique_summary = "\n".join([f"- {k}: {v}" for k, v in last_eval["critique"].items() if v != "Pass"])
            suggestions_summary = "\n".join([f"- {s}" for s in last_eval["suggestions"]])
            prompt = get_revision_prompt(term_name, history[-1]["draft"], critique_summary, suggestions_summary)
            log_event(term_name, "worker_draft", f"Worker revising draft based on critique from iteration {iteration-1}...")
            
        try:
            draft_text = run_agent_execution(worker_agent, prompt, worker_session)
        except Exception as e:
            log_event(term_name, "system_status", f"Error during Worker execution: {e}")
            break
            
        sections = parse_draft(draft_text)
        approx_tokens = len(draft_text.split()) * 1.3 # Rough approximation of tokens
        log_event(term_name, "worker_draft", f"Worker completed draft. Length: {int(approx_tokens)} tokens.")
        
        # Step B: Evaluator Agent critique
        eval_session = f"evaluator_{get_safe_filename(term_name)}_it{iteration}"
        eval_prompt = get_evaluation_prompt(term_name, draft_text)
        log_event(term_name, "evaluator_critique", "Adversarial Evaluator critiquing draft...")
        
        try:
            eval_response = run_agent_execution(evaluator_agent, eval_prompt, eval_session)
            eval_data = parse_evaluation(eval_response)
        except Exception as e:
            log_event(term_name, "system_status", f"Error during Evaluator execution: {e}")
            eval_data = {"score": 75, "critique": {"error": str(e)}, "suggestions": ["Attempt revision again."]}
            
        score = eval_data.get("score", 70)
        log_event(term_name, "evaluator_critique", f"Adversarial Evaluator score: {score}/100.", eval_data)
        
        # Log iteration to history
        history.append({
            "iteration": iteration,
            "draft": draft_text,
            "sections": sections,
            "evaluation": eval_data,
            "score": score
        })
        
        # Track the best output in case we don't hit 95 but have to stop
        if score > best_score:
            best_score = score
            best_sections = sections
            best_draft = draft_text
            
        # Update glossary in memory/db for live scoring updates
        term_entry["score"] = score
        term_entry["definition"] = sections.get("definition", "")
        term_entry["architecture"] = sections.get("architecture", "")
        term_entry["examples"] = sections.get("examples", "")
        term_entry["advantages"] = sections.get("advantages", "")
        term_entry["limitations"] = sections.get("limitations", "")
        term_entry["related_concepts"] = sections.get("related_concepts", "")
        term_entry["token_count"] = int(approx_tokens)
        term_entry["history"] = history
        
        with open(DB_PATH, "w") as f:
            json.dump(db, f, indent=2)
            
        # Check success threshold
        if score >= 95:
            log_event(term_name, "system_status", f"Quality threshold achieved ({score} >= 95)! Approving entry.")
            term_entry["status"] = "approved"
            save_markdown_file(term_name, sections, score)
            break
        elif iteration == max_iterations:
            log_event(term_name, "system_status", f"Max iterations reached ({max_iterations}). Selecting best draft with score {best_score}/100.")
            term_entry["status"] = "approved"
            term_entry["score"] = best_score
            term_entry["definition"] = best_sections.get("definition", "")
            term_entry["architecture"] = best_sections.get("architecture", "")
            term_entry["examples"] = best_sections.get("examples", "")
            term_entry["advantages"] = best_sections.get("advantages", "")
            term_entry["limitations"] = best_sections.get("limitations", "")
            term_entry["related_concepts"] = best_sections.get("related_concepts", "")
            save_markdown_file(term_name, best_sections, best_score)
            break
            
    # Final save of the database
    with open(DB_PATH, "w") as f:
        json.dump(db, f, indent=2)
        
    current_generating_term = None
    return term_entry

def generate_all_glossary_terms(max_terms: int = 50):
    global is_generation_active
    is_generation_active = True
    
    try:
        if not os.path.exists(DB_PATH):
            logger.error("DB_PATH does not exist.")
            return
            
        with open(DB_PATH, "r") as f:
            db = json.load(f)
            
        pending_terms = [t["term"] for t in db["terms"] if t["status"] == "pending"]
        
        log_event("SYSTEM", "system_status", f"Starting bulk generation. Found {len(pending_terms)} pending terms.")
        
        count = 0
        for term in pending_terms:
            if count >= max_terms:
                break
            try:
                generate_term_glossary(term)
                count += 1
            except Exception as e:
                log_event(term, "system_status", f"Error generating term: {e}")
                
        log_event("SYSTEM", "system_status", f"Bulk generation complete. Processed {count} terms.")
    finally:
        is_generation_active = False
