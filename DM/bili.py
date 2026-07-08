import sys
import os

def remove_first_n_bytes(input_file, output_file, n, expected_hex):
    """
    读取输入文件，验证并删除前n个字节，并将结果写入输出文件。
    
    :param input_file: 输入文件路径
    :param output_file: 输出文件路径
    :param n: 要删除的字节数
    :param expected_hex: 预期的前n个字节的十六进制字符串
    """
    try:
        # 打开输入文件，以二进制模式读取
        with open(input_file, 'rb') as infile:
            # 读取前n个字节
            first_n_bytes = infile.read(n)
            
            # 将读取的字节转换为十六进制字符串
            hex_data = first_n_bytes.hex()
            print(hex_data, type(hex_data))
            print(expected_hex, type(expected_hex))

            # 验证前n个字节是否符合预期
            if hex_data != expected_hex:
                print(f"前{n}个字节不符合预期。预期: {expected_hex}, 实际: {hex_data}")
                return
            
            # 跳过前n个字节
            infile.seek(n)
            
            # 打开输出文件，以二进制模式写入
            with open(output_file, 'wb') as outfile:
                # 分块读取并写入输出文件
                while True:
                    chunk = infile.read(4096)  # 每次读取4096字节
                    if not chunk:
                        break
                    outfile.write(chunk)
        
        print(f"成功删除前{n}个字节，结果已保存到{output_file}")
    except Exception as e:
        print(f"发生错误：{e}")

def get_sorted_m4s_files(folder_name):
    # 获取指定文件夹中的所有文件和子文件夹
    files = os.listdir(folder_name)
    
    # 筛选出后缀为.m4s的文件，并获取它们的绝对路径和大小
    m4s_files = []
    for file in files:
        file_path = os.path.join(folder_name, file)
        if os.path.isfile(file_path) and file.endswith('.m4s'):
            file_size = os.path.getsize(file_path)
            m4s_files.append((file_path, file_size))
    
    # 按文件大小从大到小排序
    sorted_files = sorted(m4s_files, key=lambda x: x[1], reverse=True)
    
    return sorted_files

def process(folder_name, file_name, output_name):
    n = 9
    expected_hex = '303030303030303030'
    
    file = file_name
    print('file', file)
    if  os.path.exists(file):
        output_file = folder_name+'/'+output_name
        print('output_file', output_file)
        remove_first_n_bytes(file, output_file, n, expected_hex)

def main():
    
    fold_name = sys.argv[1]


    sorted_m4s_files = get_sorted_m4s_files(fold_name)

    print(sorted_m4s_files)

    video = sorted_m4s_files[0][0]
    audio = sorted_m4s_files[-1][0]

    print(video)
    print(audio)

    process(fold_name, video, 'a.mp4')
    process(fold_name, audio, 'b.mp3')

    return
    
    n = 9  # 要删除的字节数
    
    # 音频
    file = fold_name+'/'+fold_name+'-1-30280.m4s'
    if  os.path.exists(file):
        output_file = fold_name+'/'+'b.mp3'
        remove_first_n_bytes(file, output_file, n, expected_hex)

    # 视频1080p
    file = fold_name+'/'+fold_name+'-1-30116.m4s'
    if  os.path.exists(file):
        output_file = fold_name+'/'+'a.mp4'
        remove_first_n_bytes(file, output_file, n, expected_hex)

    # 视频4K
    file = fold_name+'/'+fold_name+'-1-30120.m4s'
    if  os.path.exists(file):
        output_file = fold_name+'/'+'a.mp4'
        remove_first_n_bytes(file, output_file, n, expected_hex)
    
    



if __name__ == "__main__":
    main()