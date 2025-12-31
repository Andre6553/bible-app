# Omni Bible Theme Images

This folder contains the background images used in the "Share Verse" feature.

## File Naming
The app expects files named strictly **1.jpg** through **11.jpg**.
- `1.jpg` = Theme 1 (Ocean)
- `2.jpg` = Theme 2 (Sunset)
- etc.

## How to Update
To change a background image:
1.  **Prepare your new image**:
    *   **Format**: JPG (preferred) or PNG (rename extension to .jpg)
    *   **Dimensions**: 800x800 pixels (Square is best) or 800x600 (Landscape)
    *   **Resolution**: 72 DPI (Standard Web)
    *   **Size**: Keep under 300KB for fast loading.
2.  **Rename** your new image to match the number you want to replace (e.g., `1.jpg`).
3.  **Overwrite** the existing file in this folder.
4.  **Clear Browser Cache** to see the change immediately in the app.

## Note on Caching
Browsers cache images aggressively. If you replace an image, users might still see the old one for a few hours/days unless they hard refresh or clear their cache. Using a versioning strategy (e.g. `1.jpg?v=2`) in the code can force an update if critical.
