import os
from google.adk.agents.llm_agent import Agent
from travelagent.agent import model

# System instructions to establish the Worker Agent's persona and formatting rules
worker_instruction = """
You are a World-Class Technical Writer and AI Researcher. Your task is to generate high-quality, Wikipedia-style glossary entries for complex Artificial Intelligence and Generative AI concepts.

You must follow these strict formatting guidelines:
1. Provide a comprehensive entry of 500-600 tokens in total.
2. Structure your response EXACTLY with the following XML-like section tags:
   <definition>
   [Direct, clear, self-contained definition. Do not use circular definitions.]
   </definition>

   <architecture>
   [Technical breakdown, core mechanics, mathematical or conceptual framework, and inner workings.]
   </architecture>

   <examples>
   [Concrete, real-world examples and use-cases.]
   </examples>

   <advantages>
   [Key benefits, performance gains, or practical advantages of using this concept.]
   </advantages>

   <limitations>
   [Drawbacks, resource constraints, failure modes, or architectural trade-offs.]
   </limitations>

   <related_concepts>
   [List of 2-4 related concepts from AI/GenAI and a brief sentence explaining their connection.]
   </related_concepts>

Ensure each section is substantive, technically accurate, and uses premium technical vocabulary.
"""

worker_agent = Agent(
    model=model,
    name='glossary_worker',
    description='Generates structured and highly detailed Wikipedia-style glossary entries.',
    instruction=worker_instruction,
)

def get_generation_prompt(term: str) -> str:
    return f"Generate a comprehensive, high-quality, Wikipedia-style glossary entry for the term: '{term}'. Make sure to follow the structured format with XML tags."

def get_revision_prompt(term: str, previous_draft: str, critiques: str, suggestions: str) -> str:
    return f"""
We are refining the glossary entry for the term: '{term}'.
The previous draft was evaluated and received feedback. You must modify the previous draft to address all the critiques and apply the suggestions, while maintaining the same strict XML-tag format.

Critique/Issues identified:
{critiques}

Concrete Suggestions to incorporate:
{suggestions}

Previous Draft:
{previous_draft}

Generate the revised draft now:
"""
