import os
from PIL import Image

source_image_path = r"C:\Users\C Vishal\.gemini\antigravity-ide\brain\d7440705-9636-4047-93fb-e75090406d5d\.user_uploaded\media_1789933544070.jpg"

web_public_dir = r"d:\Zeus\frontend\public"
android_res_dir = r"d:\Zeus\frontend\android\app\src\main\res"

os.makedirs(web_public_dir, exist_ok=True)

img = Image.open(source_image_path).convert("RGBA")

# Generate Web Favicons
img.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "favicon.png"))
img.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "favicon.ico"))
img.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "apple-touch-icon.png"))
img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(web_public_dir, "icon-512.png"))

print("Web icons generated in public directory.")

# Android Mipmap dimensions
android_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

for folder, size in android_sizes.items():
    folder_path = os.path.join(android_res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Save launcher icons
    resized.save(os.path.join(folder_path, "ic_launcher.png"))
    resized.save(os.path.join(folder_path, "ic_launcher_round.png"))
    resized.save(os.path.join(folder_path, "ic_launcher_foreground.png"))
    print(f"Generated Android icons for {folder} ({size}x{size})")

print("All icons successfully generated!")
