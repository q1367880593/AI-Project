#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
移除文本文件底部的网址和水印，并自动重命名章节
"""

import re
import os
import json
from pathlib import Path

from clean import clean_text

try:
    import jieba
    import jieba.posseg as pseg
except ImportError:
    jieba = None
    pseg = None


def extract_keywords(text, top_n=5, exclude_names=None):
    """
    从文本中提取高频关键词

    Args:
        text: 文本内容
        top_n: 返回前N个高频词
        exclude_names: 需要排除的人名/称谓集合（可选）

    Returns:
        关键词列表
    """
    # 停用词列表（常见的无意义词）
    stop_words = {
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
        '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
        '自己', '这', '那', '他', '她', '它', '个', '们', '什么', '这个', '那个', '如此',
        '能', '可', '可以', '还', '来', '对', '于', '把', '被', '给', '让', '跟', '从',
        '向', '以', '为', '因', '所', '但', '而', '却', '只', '又', '及', '或', '并',
        '便', '才', '已', '经', '过', '得', '地', '着', '了', '么', '吗', '呢', '吧',
        '啊', '呀', '哦', '哪', '怎', '为何', '如何', '何', '谁', '多', '少', '几',
        '第', '章', '话', '集', '部', '篇', '节', '段', '行', '句', '字', '个字',
        '众人', '我们', '他们', '你们', '说道', '知道', '顿时', '忽然', '只见',
        '起来', '不会', '不是', '就是', '现在', '这里', '不过', '居然', '确实',
        '特别', '直接', '一点', '模样', '卑下', '半步', '男子', '女子', '全都',
        '应该', '能够', '出来', '看着', '跟着', '结果', '事情', '地方', '对面', '胆子',
        '流程', '普通', '级别', '全场', '所有人', '只是', '而是', '以及', '可能',
    }

    if exclude_names is None:
        exclude_names = set()
    else:
        exclude_names = set(exclude_names)

    # 只保留有实际含义的词性（名词/动词/形容词/成语/地名/机构名等）
    keep_flags = {'n', 'v', 'vn', 'vd', 'a', 'an', 'i', 'l', 'ns', 'nt', 'nz', 'j'}
    # 人名相关词性（nr 及各种人名变体）
    name_flags = {'nr', 'nrt', 'nrfg', 'nrf', 'nrg', 'nrj'}

    # 优先用 jieba 分词（切词质量更高），未安装时退回 2-4 字滑窗提取
    if jieba is not None:
        # 用词性标注过滤人名与虚词，只保留实义词
        words = [
            w.word for w in pseg.cut(text)
            if w.flag not in name_flags
            and w.flag in keep_flags
            and len(w.word) >= 2
            and re.fullmatch(r'[\u4e00-\u9fa5]+', w.word)
        ]
    else:
        words = re.findall(r'[\u4e00-\u9fa5]{2,4}', text)

    # 统计词频
    word_count = {}
    for word in words:
        # 过滤停用词与手动指定的人名/称谓
        if word not in stop_words and word not in exclude_names:
            word_count[word] = word_count.get(word, 0) + 1

    # 按频率排序，返回前N个
    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
    return [word for word, count in sorted_words[:top_n]]


def rename_chapter(content, exclude_names=None):
    """
    自动重命名章节标题

    Args:
        content: 文件内容
        exclude_names: 需要排除的人名/称谓集合（可选）

    Returns:
        (重命名后的内容, 新章节名, 章节编号)
    """
    lines = content.split('\n')
    if not lines:
        return content, None, None

    # 匹配章节标题格式：第xxx章 xxx
    chapter_pattern = r'^(第\d+章)\s+(.+)$'
    match = re.match(chapter_pattern, lines[0].strip())

    new_chapter_name = None
    chapter_number = None

    if match:
        chapter_num = match.group(1)  # 第xxx章
        chapter_name = match.group(2)  # 章节名

        # 提取章节编号（纯数字）
        num_match = re.search(r'第(\d+)章', chapter_num)
        if num_match:
            chapter_number = num_match.group(1)

        # 如果章节名是"作者懒得起名"或类似的，就替换
        if '懒得起名' in chapter_name or '作者' in chapter_name:
            # 提取正文内容（前100行）
            content_text = '\n'.join(lines[1:100])

            # 提取高频关键词
            keywords = extract_keywords(content_text, top_n=5, exclude_names=exclude_names)

            if keywords:
                # 选择第一个高频词作为章节名
                # 如果第一个词太普通，可以组合前两个
                new_name = keywords[0]

                # 如果关键词太短（2个字），尝试组合
                if len(new_name) == 2 and len(keywords) > 1:
                    # 检查是否可以组合成有意义的短语
                    combined = new_name + keywords[1]
                    if len(combined) <= 6:  # 避免章节名太长
                        new_name = combined

                lines[0] = f'{chapter_num} {new_name}'
                new_chapter_name = new_name
                print(f'章节重命名: "{chapter_name}" -> "{new_name}"')
                print(f'  提取的关键词: {", ".join(keywords[:3])}')
            else:
                # 如果没找到关键词，用通用名称
                new_name = '正文'
                lines[0] = f'{chapter_num} {new_name}'
                new_chapter_name = new_name
                print(f'章节重命名: "{chapter_name}" -> "{new_name}"（未找到关键词）')

    return '\n'.join(lines), new_chapter_name, chapter_number


def remove_watermark(input_file, output_file=None, rename=True, rename_file=False, exclude_names=None):
    """
    移除文本文件底部的网址水印

    Args:
        input_file: 输入文件路径
        output_file: 输出文件路径（如果为None，则覆盖原文件）
        rename: 是否自动重命名章节（默认True）
        rename_file: 是否根据章节名重命名文件（默认False）
        exclude_names: 需要排除的人名/称谓集合（可选）
    """
    # 读取文件内容
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 按行分割内容，供统计行数使用
    lines = content.split('\n')

    # 统一清洗：删除水印片段、过滤水印/网址行、去除末尾空行
    cleaned_content = clean_text(content)
    cleaned_lines = cleaned_content.split('\n')

    # 章节名和章节编号
    new_chapter_name = None
    chapter_number = None

    # 如果需要，重命名章节
    if rename:
        cleaned_content, new_chapter_name, chapter_number = rename_chapter(cleaned_content, exclude_names=exclude_names)

    # 确定输出文件路径
    if output_file is None:
        output_file = input_file

    # 如果需要重命名文件
    if rename_file and new_chapter_name and chapter_number:
        file_path = Path(input_file)
        new_filename = f"第{chapter_number}章 {new_chapter_name}.txt"
        output_file = str(file_path.parent / new_filename)

        # 如果原文件和新文件名不同，需要删除原文件
        if str(file_path) != output_file:
            print(f'文件重命名: {file_path.name} -> {new_filename}')

    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)

    # 如果重命名了文件且原文件还存在，删除原文件
    if rename_file and output_file != input_file and os.path.exists(input_file):
        os.remove(input_file)

    print(f"处理完成！已保存到: {output_file}")
    print(f"原始行数: {len(lines)}")
    print(f"清理后行数: {len(cleaned_lines)}")


def batch_remove_watermark(folder_path, rename=True, rename_file=False, exclude_names=None):
    """
    批量处理文件夹中的所有txt文件

    Args:
        folder_path: 文件夹路径
        rename: 是否自动重命名章节（默认True）
        rename_file: 是否根据章节名重命名文件（默认False）
        exclude_names: 需要排除的人名/称谓集合（可选）
    """
    folder = Path(folder_path)

    if not folder.exists():
        print(f"错误：文件夹 {folder_path} 不存在！")
        return

    # 查找所有txt文件
    txt_files = list(folder.glob('*.txt'))

    if not txt_files:
        print(f"文件夹 {folder_path} 中没有找到txt文件")
        return

    print(f"找到 {len(txt_files)} 个txt文件，开始处理...")
    print("=" * 60)

    success_count = 0
    fail_count = 0

    for txt_file in txt_files:
        try:
            print(f"\n正在处理: {txt_file.name}")
            remove_watermark(str(txt_file), rename=rename, rename_file=rename_file, exclude_names=exclude_names)
            success_count += 1
        except Exception as e:
            print(f"处理失败: {txt_file.name}")
            print(f"错误信息: {e}")
            fail_count += 1

    print("\n" + "=" * 60)
    print(f"批量处理完成！")
    print(f"成功: {success_count} 个文件")
    print(f"失败: {fail_count} 个文件")


if __name__ == '__main__':
    # 从 config.json 读取需要排除的人名/称谓（如主角名、尊号等）
    exclude_names = []
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            exclude_names = json.load(f).get('exclude_names', [])
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # 使用示例

    # 方式1: 批量处理整个文件夹（重命名章节和文件）
    folder_path = './xiaohua'
    batch_remove_watermark(folder_path, rename=True, rename_file=True, exclude_names=exclude_names)

    # 方式2: 只重命名章节，不重命名文件
    # batch_remove_watermark(folder_path, rename=True, rename_file=False)

    # 方式3: 只去水印，不重命名
    # batch_remove_watermark(folder_path, rename=False, rename_file=False)

    # 方式4: 处理单个文件
    # input_file = '/Users/xiaolongbao/Documents/py/xiaohuatemp/aa.txt'
    # remove_watermark(input_file, rename=True, rename_file=True)
