from PIL import Image
import sys

def convert_to_rgb565(image_path, output_path, width=160, height=128):
    img = Image.open(image_path).convert('RGB')
    img = img.resize((width, height), Image.Resampling.LANCZOS)
    
    with open(output_path, 'w') as f:
        f.write("const uint16_t syncPackLogo[] PROGMEM = {\n")
        pixels = []
        for y in range(height):
            for x in range(width):
                r, g, b = img.getpixel((x, y))
                # Convert to RGB565
                rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                pixels.append(f"0x{rgb565:04X}")
            f.write(", ".join(pixels[-width:]) + ",\n")
        f.write("};\n")

if __name__ == "__main__":
    convert_to_rgb565(sys.argv[1], "logo.h")
