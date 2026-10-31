from PIL import Image
import os

src = r'public\images\Logo.png'
out_dir = r'public\icons'
logo = Image.open(src).convert('RGBA')

sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    icon = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    max_dim = int(size * 0.8)
    ratio = min(max_dim / logo.width, max_dim / logo.height)
    new_w = int(logo.width * ratio)
    new_h = int(logo.height * ratio)
    resized = logo.resize((new_w, new_h), Image.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    icon.paste(resized, (x, y), resized)
    icon.save(os.path.join(out_dir, f'icon-{size}x{size}.png'))
    print(f'Generated icon-{size}x{size}.png')
