import os
from google.adk.agents.llm_agent import Agent

if os.getenv("LITELLM_API_BASE"):
    from google.adk.models.lite_llm import LiteLlm
    model = LiteLlm(
        model="openai/openai/gpt-oss-20b",
        api_base=os.getenv("LITELLM_API_BASE"), 
        api_key=os.getenv("LITELLM_API_KEY", "sv-openai-api-key")
    )
else:
    from google.adk.models import Gemini
    model = Gemini()

root_agent = Agent(
    model=model,
    name='root_agent',
    description='A helpful assistant for user questions.',
    instruction='Answer user questions to the best of your knowledge',
)
