# Alumex Mould Tracker — Multiple profile names in one outsourcing record

## What changed
- In the existing **Record Outsourced Mould** form, choose Profile Name first, then Mould Code as before.
- Under Mould Code, the new **Other profile names for the same mould (optional)** section lets you select one or more additional profile names from your inventory, or enter another profile name manually.
- Each extra name appears as a removable chip. The main profile cannot be duplicated.
- The selected names are saved in the existing `outsourcing.notes` text field as `Profiles used: AL 522 / AL 523` (followed by any Notes). One mould creates **one outsourcing record**; availability changes for the physical mould.
- This is a record of profiles for the particular outsourcing job; it does not edit the master inventory's permanent mould-to-profile mapping.

## Upload to GitHub
1. Upload **index.html**, **app.js**, **styles.css** to your existing repository root, replacing those three files.
2. Do not replace `config.js`. No database migration is needed.
3. Commit, then refresh the deployed website using Ctrl+Shift+R.
4. Admin sign in → + Record Outsourced Mould → choose primary profile/mould → add another profile → complete form → save.

**Note:** If the profile is not already part of the mould's master compatibility list, adding it here records it for this outsourcing transaction only. Verify technical compatibility separately before using the mould. Public visibility of notes depends on the current Supabase public summary policy.
