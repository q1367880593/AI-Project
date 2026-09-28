#!/usr/bin/env python3
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

def epub_to_txt(epub_path, txt_path):
    book = epub.read_epub(epub_path)

    chapters = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            text = soup.get_text()
            chapters.append(text)

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(chapters))

    print(f"转换完成！文件保存为: {txt_path}")

if __name__ == "__main__":
    epub_to_txt("a.epub", "a.txt")
