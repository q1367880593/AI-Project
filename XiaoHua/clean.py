# -*- coding: utf-8 -*-
"""
清洗规则：去除小说文本中的网址、水印与广告文案。

统一在此维护，供 xiaohua.py（抓取时）与 remove_watermark.py（后处理时）复用，
避免两处重复维护。
"""

import re

# 整行为网址链接，如 (https://...)
URL_PATTERN = r'^\s*\(https?://[^\)]+\)\s*$'

# 行内包含的水印文字
WATERMARK_PATTERN = r'^\s*.*?(?:[0-9]+秒记住|手机版阅读网址|阅读网址).*?$'

# 正文中混入、需直接删除的广告/水印片段
STRIP_FRAGMENTS = [
    ' >  >  >',
    '←  →',
    '热门推荐：',
    '&nbsp;',
    '推荐都市大神老施新书:',
    '1秒记住千千小说：www.xqianqian.net。手机版阅读网址：m.xqianqian.net',
    '1秒记住千千小说：www.xqianqian.com。手机版阅读网址：m.xqianqian.com',
    '<div  class="contentadv">',
]


def is_watermark_line(line):
    """判断某一行是否为需要删除的网址或水印行。"""
    return bool(re.match(URL_PATTERN, line) or re.match(WATERMARK_PATTERN, line))


def clean_text(content):
    """对文本执行统一清洗：删除水印片段、过滤水印行、去除末尾空行。"""
    for fragment in STRIP_FRAGMENTS:
        content = content.replace(fragment, '')

    lines = content.split('\n')
    cleaned = [line for line in lines if not is_watermark_line(line)]

    while cleaned and not cleaned[-1].strip():
        cleaned.pop()

    return '\n'.join(cleaned)