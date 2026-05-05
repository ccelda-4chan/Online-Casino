import ftplib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
local_root = root / 'dist' / 'public'
if not local_root.exists():
    raise FileNotFoundError(f'Build output not found: {local_root}')

HOST = 'ftpupload.net'
USER = 'if0_41831439'
PASSWD = 'FUFioL02wkCvR'
REMOTE_ROOT = 'htdocs'

print('Connecting to FTP...')
ftp = ftplib.FTP(HOST, timeout=60)
ftp.login(USER, PASSWD)
print('Connected:', ftp.getwelcome())
ftp.cwd(REMOTE_ROOT)


def ensure_remote_dir(path):
    if not path:
        return
    parts = path.replace('\\', '/').split('/')
    current = []
    for part in parts:
        if not part:
            continue
        current.append(part)
        folder = '/'.join(current)
        try:
            ftp.mkd(folder)
            print('Created remote dir:', folder)
        except ftplib.error_perm as err:
            if '550' in str(err):
                pass
            else:
                raise


def upload_directory(local_dir: Path, remote_dir=''):
    for entry in sorted(local_dir.iterdir()):
        remote_path = f"{remote_dir}/{entry.name}" if remote_dir else entry.name
        if entry.is_dir():
            ensure_remote_dir(remote_path)
            upload_directory(entry, remote_path)
        else:
            with entry.open('rb') as f:
                print('Uploading', remote_path)
                ftp.storbinary(f'STOR {remote_path}', f)

upload_directory(local_root)
ftp.quit()
print('FTP upload complete.')
