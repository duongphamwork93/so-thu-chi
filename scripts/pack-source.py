import os
import zipfile

def pack():
    out_dir = "public"
    os.makedirs(out_dir, exist_ok=True)
    zip_path = os.path.join(out_dir, "so-thu-chi-source.zip")
    if os.path.exists(zip_path):
        try:
            os.remove(zip_path)
        except Exception:
            pass

    include_dirs = ["src", "api"]
    include_files = [
        "index.html",
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "server.ts",
        "vercel.json",
        "README.md",
        ".gitignore",
        ".env.example",
        "metadata.json",
        "firebase-applet-config.json",
        "firestore.rules"
    ]

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for f in include_files:
            if os.path.exists(f):
                z.write(f, arcname=f)
        for d in include_dirs:
            if os.path.exists(d):
                for root, _, files in os.walk(d):
                    for file in sorted(files):
                        full = os.path.join(root, file)
                        arc = os.path.relpath(full, ".")
                        z.write(full, arcname=arc)
    return zip_path

if __name__ == "__main__":
    p = pack()
    print(f"Packed {p} successfully, size: {os.path.getsize(p)} bytes")
