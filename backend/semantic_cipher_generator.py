import json
import os
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv
from typing import List, Dict

# Load environment variables from the .env file in the project root
load_dotenv()

# --- CONFIGURATION ---
WORDLIST_FILE = 'wordlist.txt'
OUTPUT_FILE = 'gopher_archive.json'
MODEL_NAME = 'gemini-2.5-flash'
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# TIME DELAY (Crucial for RPM compliance)
THROTTLE_DELAY_SECONDS = 7  # Ensures max ~10 requests per minute (60s/6s)
MAX_WORDS_TO_PROCESS = 6000
BATCH_SIZE = 100  # Safe, low batch size

if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not found. Cannot run generator.")
    exit()

client = genai.Client(api_key=GEMINI_API_KEY)

# --- INSTRUCTION FOR THE AI ---
SYSTEM_INSTRUCTION = """
You are an ancient, digital medium, tasked with generating a single, concise, spooky prophecy for a given word.
The prophecy must be highly thematic, archaic, and unsettling, based on the word's primary meaning.

Your output MUST be a valid JSON array of objects.
For each word provided, you must return an object with the following structure:
{
    "word": "original word",
    "cipher": "The unique, short, cryptic prophecy.",
    "is_valid": true/false (Set to false if the word is a proper noun, acronym, or has no common meaning, otherwise true.)
}
"""


def generate_ciphers_for_batch(batch_words: List[str]) -> List[Dict]:
    """Sends a batch of words to the LLM for structured cipher generation."""

    prompt = f"Generate a unique cipher and validity flag for each of the following words:\n{', '.join(batch_words)}"

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.9,
                response_mime_type="application/json",
                # --- CORRECTED JSON SCHEMA FOR ARRAY OF OBJECTS ---
                response_schema={
                    "type": "array",
                    "items": {  # <-- CRITICAL FIX: Defines the structure of each item in the array
                        "type": "object",
                        "properties": {
                            "word": {"type": "string"},
                            "cipher": {"type": "string"},
                            "is_valid": {"type": "boolean"}
                        },
                        "required": ["word", "cipher", "is_valid"]
                    }
                }
            )
        )

        return json.loads(response.text)

    except Exception as e:
        print(f"  [Error] API Error during batch generation: {e}")
        return []


def run_semantic_generator():
    try:
        with open(WORDLIST_FILE, 'r', encoding='utf-8') as f:
            all_words = f.read().splitlines()
    except FileNotFoundError:
        print(f"Error: Wordlist file '{WORDLIST_FILE}' not found.")
        return

    # Filter and clean the initial 6000 words we need to process
    clean_words = [w.strip()
                   for w in all_words if w.strip()][:MAX_WORDS_TO_PROCESS]

    print(
        f"Starting semantic cipher generation for {len(clean_words)} words...")

    # Load original 5 manually created entries first
    try:
        with open(OUTPUT_FILE, 'r') as f:
            initial_entries = json.load(f)
            # Filter out all template-generated words (those that used the old
            # /menu/word/ path)
            final_archive = [
                e for e in initial_entries if not e['path'].startswith('/menu/word/')]
    except (FileNotFoundError, json.JSONDecodeError):
        # If the file is missing or corrupted, we start with an empty list
        final_archive = []

    start_id = 1000
    successful_ciphers = 0

    for i in range(0, len(clean_words), BATCH_SIZE):
        batch = clean_words[i:i + BATCH_SIZE]

        processed_batch = generate_ciphers_for_batch(batch)

        if not processed_batch:
            print(f"Batch {i//BATCH_SIZE + 1} failed. Skipping...")
        else:
            for item in processed_batch:
                # Check for 'is_valid' from the new LLM response and 'cipher'
                # content
                if item.get("is_valid") is True and item.get("cipher"):
                    word = item.get('word', '').strip()
                    cipher = item['cipher'].strip()

                    if len(cipher) > 5 and len(word) > 1:
                        final_archive.append({
                            "id": start_id,
                            "path": f"/menu/semantic/{word.lower()}",
                            "content": cipher
                        })
                        start_id += 1
                        successful_ciphers += 1

            print(
                f"  Processed {i + len(batch)}/{len(clean_words)}. Current good entries: {successful_ciphers}")

        # --- THROTTLING MECHANISM (Ensures compliance with RPM limit) ---
        if i + BATCH_SIZE < len(clean_words):
            print(
                f"  Waiting {THROTTLE_DELAY_SECONDS} seconds to comply with API rate limit...")
            time.sleep(THROTTLE_DELAY_SECONDS)

    # 4. Write the final, high-quality archive
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_archive, f, indent=2)

    print(f"\n--- SEMANTIC GENERATION COMPLETE ---")
    print(f"Total words processed: {len(clean_words)}")
    print(f"Successful unique entries created: {successful_ciphers}")
    print("Your Gopher Archive now contains unique, high-quality, thematic ciphers!")


if __name__ == "__main__":
    run_semantic_generator()
