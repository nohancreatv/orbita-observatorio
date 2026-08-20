from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

SOURCE = Path('/home/ubuntu/upload/search_images')
DESTINATION = Path('/home/ubuntu/webdev-static-assets')
DESTINATION.mkdir(parents=True, exist_ok=True)

def open_and_fit(filename: str, size=(2048, 1024)):
    image = Image.open(SOURCE / filename).convert('RGB')
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)

day = open_and_fit('NOm5nCBz96uW.png')
day = ImageEnhance.Color(day).enhance(0.84)
day = ImageEnhance.Contrast(day).enhance(1.08)
day.save(DESTINATION / 'earth-day-atlas.jpg', quality=88, optimize=True, progressive=True)

night = open_and_fit('yxACuw4s6xli.jpg')
night = ImageEnhance.Brightness(night).enhance(0.72)
night = ImageEnhance.Color(night).enhance(0.9)
night.save(DESTINATION / 'earth-night-atlas.jpg', quality=84, optimize=True, progressive=True)

cloud_source = Image.open(SOURCE / '5iMuIBNabbSA.jpg').convert('L')
cloud_source = ImageOps.fit(cloud_source, (1024, 512), method=Image.Resampling.LANCZOS)
alpha = cloud_source.point(lambda pixel: max(0, min(190, int((pixel - 38) * 1.35))))
clouds = Image.new('RGBA', cloud_source.size, (204, 238, 248, 0))
clouds.putalpha(alpha)
clouds.save(DESTINATION / 'earth-clouds-atlas.png', optimize=True)

print('\n'.join(str(DESTINATION / name) for name in ('earth-day-atlas.jpg', 'earth-night-atlas.jpg', 'earth-clouds-atlas.png')))
