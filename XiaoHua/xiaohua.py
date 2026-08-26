# coding:utf-8
import json
import os
import time

import requests
from lxml import etree

from clean import clean_text

CONFIG_FILE = 'config.json'


def load_config():
    """读取本地配置文件；缺失时提示并退出。"""
    if not os.path.exists(CONFIG_FILE):
        print(f"错误：缺少配置文件 {CONFIG_FILE}，请先创建。")
        exit(1)
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def downLoadPage(page):
    url = page
    print("start RP :", page)
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240"

    with requests.request('GET', url, headers={'User-agent': ua}) as res:
        res.encoding = res.apparent_encoding
        content = res.text  # 获取HTML的内容

        dic = {}

        html = etree.HTML(content, parser=etree.HTMLParser(encoding='utf-8'))
        # 获取正文
        sentences = html.xpath("//div[@id='content']/text()")

        # 获取下一章链接
        nextChapter = html.xpath("//div[@class='page_chapter']//a")
        if len(nextChapter) > 3:
            next = nextChapter[2]
            herf = next.get("href")
            dic["nextHerf"] = herf
        else:
            dic["nextHerf"] = ""

        # 获取章节文
        chapterText = ""
        for sentence in sentences:
            chapterText += '\n'
            chapterText += sentence

        dic["content"] = chapterText
        return dic


if __name__ == '__main__':
    config = load_config()

    baseURL = config['base_url']
    herf = config['herf']  # 当前章节地址（首次运行为起始地址）
    idx = config['idx']    # 当前章节号
    sleep_seconds = config.get('sleep_seconds', 66)
    max_retry = config.get('max_retry', 3)
    output_dir = config.get('output_dir', 'xiaohua')
    max_chapters = config.get('max_chapters', 0)  # 0 表示不限制

    os.makedirs(output_dir, exist_ok=True)
    print(f"从第 {idx} 章开始，herf = {herf}")

    count = 0  # 本次已爬取的章数

    while True:
        # 带重试地抓取本章
        chapterDic = None
        for attempt in range(1, max_retry + 1):
            try:
                chapterDic = downLoadPage(baseURL + herf)
                break
            except Exception as e:
                print(f"抓取失败({attempt}/{max_retry}): {e}")
                if attempt < max_retry:
                    time.sleep(5)
        if chapterDic is None:
            print(f"第 {idx} 章经 {max_retry} 次重试仍失败，已停止")
            break

        z = '第' + str(idx) + '章'

        content = clean_text(chapterDic["content"])
        content = content.replace('(' + baseURL + herf + ')', '')
        content = content.replace(z, '')
        title = '第' + str(idx) + '章 作者懒得起名'
        content = title + '\n' + content

        print("title==>", title)
        fileName = os.path.join(output_dir, title + ".txt")
        with open(fileName, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1

        nextHerf = chapterDic["nextHerf"]
        print("next==>", nextHerf)

        if not nextHerf or '.html' not in nextHerf:
            print("已抓取到最后一章，结束")
            break

        # 更新进度并进入下一章（章节号与 herf 的关联关系写回配置文件）
        idx += 1
        herf = nextHerf
        config['herf'] = herf
        config['idx'] = idx
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

        if max_chapters and count >= max_chapters:
            print(f"已爬取 {count} 章，达到目标，停止")
            break

        time.sleep(sleep_seconds)