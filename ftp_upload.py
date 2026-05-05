import ftplib
import os
import sys

HOST = 'ftpupload.net'
USER = 'if0_41831439'
PASSWD = 'FUFioL02wkCvR'
REMOTE_ROOT = 'htdocs'
LOCAL_ROOT = os.path.join(os.getcwd(), 'dist', 'public')

print('Local root:', LOCAL_ROOT)
if not os.path.isdir(LOCAL_ROOT):
    print('Local build directory not found:', LOCAL_ROOT)
    sys.exit(1)

ftp = ftplib.FTP(HOST, timeout=30)
ftp.login(USER, PASSWD)
print('Connected:', ftp.getwelcome())

try:
    ftp.cwd(REMOTE_ROOT)
except Exception as e:
    print('Cannot cwd to', REMOTE_ROOT, e)
    ftp.quit()
    sys.exit(1)


def ensure_remote_dir(path):
    if not path:
        return
    parts = path.split('/')
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


def delete_remote_item(name):
    if name in ('.', '..'):
        return
    try:
        ftp.cwd(name)
        ftp.cwd('..')
        delete_remote_directory(name)
        ftp.rmd(name)
        print('Removed remote dir:', name)
    except ftplib.error_perm:
        try:
            ftp.delete(name)
            print('Removed remote file:', name)
        except ftplib.error_perm as err:
            print('Failed to remove remote item:', name, err)


def delete_remote_directory(path):
    current = ftp.pwd()
    ftp.cwd(path)
    items = [item for item in ftp.nlst() if item not in ('.', '..')]
    for item in items:
        delete_remote_item(item)
    ftp.cwd(current)


def upload_directory(local_dir, remote_dir=''):
    for name in sorted(os.listdir(local_dir)):
        local_path = os.path.join(local_dir, name)
        remote_path = f'{remote_dir}/{name}' if remote_dir else name
        if os.path.isdir(local_path):
            ensure_remote_dir(remote_path)
            upload_directory(local_path, remote_path)
        else:
            with open(local_path, 'rb') as f:
                print('Uploading', remote_path)
                ftp.storbinary(f'STOR {remote_path}', f)


print('Cleaning remote directory:', REMOTE_ROOT)
remote_items = [item for item in ftp.nlst() if item not in ('.', '..')]
for item in remote_items:
    delete_remote_item(item)

upload_directory(LOCAL_ROOT)
ftp.quit()
print('FTP upload complete')
