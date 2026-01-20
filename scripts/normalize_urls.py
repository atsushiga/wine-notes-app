import os
import re
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(".env.local")

url: str = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Supabase URL and Key are required.")
    exit(1)

supabase: Client = create_client(url, key)

def normalize_urls():
    # Fetch all tasting notes with image_url
    print("Fetching tasting notes...")
    # We can filter for those starting with http to save bandwidth, but let's fetch all 
    # checking valid ones just in case.
    res = supabase.table("tasting_notes").select("id, image_url").not_.is_("image_url", "null").execute()
    notes = res.data

    updates = []
    
    # Regex to find the 'uploads/...' part. 
    # Assuming GCS URLs contain 'uploads/...' or similar.
    # Or maybe we just look for common patterns.
    
    # Expected relative format: /api/images/uploads/YYYY/MM/filename
    
    count = 0
    for note in notes:
        original = note["image_url"]
        if not original:
            continue
            
        if original.startswith("http"):
            # It's an absolute URL.
            # We need to extract the path.
            # Example: https://storage.googleapis.com/bucket/uploads/2024/01/file.jpg
            # We want: /api/images/uploads/2024/01/file.jpg
            
            # Strategy: Find "uploads/"
            idx = original.find("uploads/")
            if idx != -1:
                # Extract starting from uploads/
                relative_path = "/api/images/" + original[idx:]
                
                print(f"ID: {note['id']}")
                print(f"  Old: {original}")
                print(f"  New: {relative_path}")
                
                updates.append({"id": note["id"], "image_url": relative_path})
                count += 1
            else:
                print(f"Skipping unknown format: {original}")

    if count == 0:
        print("No URLs needed normalization.")
        return

    print(f"\nFound {count} records to update.")
    confirm = input("Do you want to proceed with the update? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    print("Updating records...")
    for update in updates:
        try:
            supabase.table("tasting_notes").update({"image_url": update["image_url"]}).eq("id", update["id"]).execute()
            print(f"Updated ID {update['id']}")
        except Exception as e:
            print(f"Failed to update ID {update['id']}: {e}")

    print("Done.")

if __name__ == "__main__":
    normalize_urls()
