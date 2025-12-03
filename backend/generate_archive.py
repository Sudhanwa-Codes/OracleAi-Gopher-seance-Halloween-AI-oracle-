import json

import os

# --- Configuration ---
WORDLIST_FILE = 'wordlist.txt'
OUTPUT_FILE = 'gopher_archive.json'
BATCH_SIZE = 100
# We are manually setting the slice to process words 2,001 through 6,000
START_INDEX = 2000
END_INDEX = 6000


# --- Helper function to create cryptic content ---
def create_cryptic_entry(word, index):
    """Generates a structured Gopher entry for a given word."""
    # We use a large ID number to avoid conflicts with existing entries
    return {
        "id": index + 10000,
        "path": f"/menu/word/{word.lower()}",
        "content": f"The ghost of the past whispers the word: {word}. Verily, all knowledge ends in this singular truth."
    }

# --- Main generation function ---


def generate_batches():
    try:
        # 1. READ THE FULL WORD LIST
        with open(WORDLIST_FILE, 'r', encoding='utf-8') as f:
            all_words = f.read().splitlines()
    except FileNotFoundError:
        print(
            f"Error: Wordlist file '{WORDLIST_FILE}' not found in the /backend folder.")
        return

    # Filter out empty lines and standardize words
    clean_words = [w.strip() for w in all_words if w.strip()]

    # 2. SLICE THE LIST TO GET THE TARGET RANGE (2001 to 6000)
    # Python uses 0-based indexing, so index 2000 is the 2001st word, and the
    # slice stops *before* index 6000.
    words_to_process = clean_words[START_INDEX:END_INDEX]

    print(f"Found {len(clean_words)} total words. Slicing to process words from index {START_INDEX} to {END_INDEX}...")
    print(f"Total entries to be generated: {len(words_to_process)}")

    new_archive_data = []

    # Process words in batches of 100
    for i in range(0, len(words_to_process), BATCH_SIZE):
        batch = words_to_process[i:i + BATCH_SIZE]
        print(
            f"Processing Batch {i//BATCH_SIZE + 1} ({len(batch)} entries)...")

        # We need to offset the index for unique ID generation
        current_global_index = START_INDEX + i

        for j, word in enumerate(batch):
            new_archive_data.append(
                create_cryptic_entry(
                    word, current_global_index + j))

    # 3. LOAD EXISTING DATA AND APPEND NEW DATA
    try:
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, 'r') as f:
                existing_data = json.load(f)
        else:
            # If the file doesn't exist (e.g., first run ever)
            existing_data = []
    except json.JSONDecodeError:
        print(
            f"Warning: Existing {OUTPUT_FILE} is empty or corrupted. Starting fresh.")
        existing_data = []

    final_archive = existing_data + new_archive_data

    # 4. WRITE THE FINAL CONSOLIDATED DATA
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_archive, f, indent=2)

    print(f"\n--- SUCCESS ---")
    print(f"Generated and appended {len(new_archive_data)} new entries.")
    print(f"Total entries in {OUTPUT_FILE}: {len(final_archive)}")


if __name__ == "__main__":
    generate_batches()
