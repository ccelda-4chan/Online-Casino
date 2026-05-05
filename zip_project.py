import os, zipfile, pathlib
root = pathlib.Path('.').resolve()
zip_path = root / 'online-casino-final.zip'
exclude_dirs = {'node_modules', '.git', '.github', 'dist', '.venv', 'client/node_modules', 'client/dist', 'client/.vite'}
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for current_dir, dirs, files in os.walk(root):
        rel_dir = pathlib.Path(current_dir).relative_to(root)
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not any(part in exclude_dirs for part in (rel_dir / d).parts)]
        for file in files:
            path = pathlib.Path(current_dir) / file
            rel_path = path.relative_to(root)
            if any(part in exclude_dirs for part in rel_path.parts):
                continue
            zf.write(path, rel_path)
print('created', zip_path, 'size', zip_path.stat().st_size)
