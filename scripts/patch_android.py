"""Run in CI after `npx cap add android`: lock landscape, go fullscreen, use the game's icon."""
import re, pathlib, shutil, sys

root = pathlib.Path('android/app/src/main')
manifest = root / 'AndroidManifest.xml'
m = manifest.read_text()
if 'screenOrientation' not in m:
    m = m.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"', 1)
manifest.write_text(m)

styles = root / 'res/values/styles.xml'
st = styles.read_text()
extra = ('\n        <item name="android:windowFullscreen">true</item>'
         '\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>')
new, n = re.subn(r'(<style name="AppTheme\.NoActionBar"[^>]*>)', r'\1' + extra, st, count=1)
if n == 0:
    print('WARNING: could not patch theme for fullscreen (game still works).', file=sys.stderr)
styles.write_text(new)

# launcher icon: replace all mipmap launcher PNGs with the game's icon
from PIL import Image  # installed in the workflow
icon = Image.open('icons/icon-512.png').convert('RGBA')
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for dens, px in sizes.items():
    d = root / f'res/mipmap-{dens}'
    for name in ('ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'):
        if (d / name).exists():
            icon.resize((px if 'foreground' not in name else int(px * 2.25), px if 'foreground' not in name else int(px * 2.25)), Image.LANCZOS).save(d / name)
# adaptive icons (anydpi) would override the PNGs on Android 8+, so drop them
for f in (root / 'res/mipmap-anydpi-v26').glob('ic_launcher*.xml'):
    f.unlink()
print('Android project patched.')
