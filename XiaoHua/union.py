import os
import re


def extract_chapter_number(filename):
    """从文件名中提取章节编号（格式：第N章），失败返回 None。"""
    match = re.search(r'第(\d+)章', filename)
    return int(match.group(1)) if match else None


if __name__ == '__main__':
    path = 'xiaohua'

    files = [f for f in os.listdir(path) if f.endswith('.txt')]
    if not files:
        print(f"错误：{path} 目录下没有 txt 文件")
        exit(1)

    # 按章节编号排序，避免字符串字典序导致"第100章"排在"第10章"前面
    files.sort(key=lambda name: extract_chapter_number(name) or 0)
    print(files)

    union_str = ""
    start_name = files[0]
    end_name = files[-1]

    for file_name in files:
        filePath = os.path.join(path, file_name)
        print(filePath)
        with open(filePath, 'r', encoding='utf-8') as f:
            union_str += f.read()
            union_str += "\n\n"  # 每个章节之间加两个换行符

    a = extract_chapter_number(start_name)
    b = extract_chapter_number(end_name)

    output_file = f"{a}-{b}.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(union_str)

    print(f"已合并 {len(files)} 个章节 -> {output_file}")