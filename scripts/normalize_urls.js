const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        let value = line.substring(idx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Error: Supabase URL and Key are required.");
    process.exit(1);
}

const supabase = createClient(url, key);

async function normalizeUrls() {
    console.log("Fetching tasting notes...");

    // Fetch all records with image_url not null
    const { data: notes, error } = await supabase
        .from('tasting_notes')
        .select('id, image_url')
        .not('image_url', 'is', null);

    if (error) {
        console.error("Error fetching notes:", error);
        return;
    }

    const updates = [];

    for (const note of notes) {
        const original = note.image_url;
        if (!original) continue;

        if (original.startsWith('http')) {
            const idx = original.indexOf('uploads/');
            if (idx !== -1) {
                const relativePath = '/api/images/' + original.substring(idx);
                console.log(`ID: ${note.id}`);
                console.log(`  Old: ${original}`);
                console.log(`  New: ${relativePath}`);
                updates.push({ id: note.id, image_url: relativePath });
            } else {
                // Check if it's already a relative path but just absolute URL
                // e.g. https://domain.com/api/images/...
                const apiIdx = original.indexOf('/api/images/');
                if (apiIdx !== -1 && apiIdx > 0) {
                    const relativePath = original.substring(apiIdx);
                    console.log(`ID: ${note.id}`);
                    console.log(`  Old: ${original}`);
                    console.log(`  New: ${relativePath}`);
                    updates.push({ id: note.id, image_url: relativePath });
                } else {
                    console.log(`Skipping unknown format: ${original}`);
                }
            }
        }
    }

    if (updates.length === 0) {
        console.log("No URLs needed normalization.");
        return;
    }

    console.log(`\nFound ${updates.length} records to update.`);

    // Since we want to run non-interactively in this environment mostly:
    // But I can simulate input or just proceed if I'm confident. 
    // The user asked to do it.

    // I will just execute for now, as asking for input in node script via run_command with input piping is same complexity.
    // I'll add a simple prompt logic just in case.

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Do you want to proceed with the update? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
            console.log("Updating records...");
            for (const update of updates) {
                const { error: updateError } = await supabase
                    .from('tasting_notes')
                    .update({ image_url: update.image_url })
                    .eq('id', update.id);

                if (updateError) {
                    console.error(`Failed to update ID ${update.id}:`, updateError);
                } else {
                    console.log(`Updated ID ${update.id}`);
                }
            }
            console.log("Done.");
        } else {
            console.log("Aborted.");
        }
        rl.close();
    });
}

normalizeUrls();
