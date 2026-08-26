import os
import re



def extract_numbers(string):
    pattern = r'\d+' # 匹配连续的数字
    numbers = re.findall(pattern, string)
    
    return [int(num) for num in numbers][0]
 

if __name__ == '__main__':
    
    
    path = 'xiaohua'
    
    idx = 0
    union_str = ""
    start_name = ""
    end_name = ""
    
    
    files = [f for f in os.listdir(path) if f.endswith('.txt')]
    # 按章节数字排序，避免字符串字典序导致"第100章"排在"第10章"前面
    files.sort(key=lambda name: extract_numbers(name))
    print(files)

    for file_name in files:
        if idx == 0:
            start_name = file_name
        end_name = file_name
        idx += 1

        filePath = os.path.join(path, file_name)
        print(filePath)
        with open(filePath, 'r', encoding='utf-8') as f:
            union_str += f.read()
    
    print(start_name)
    print(end_name)
    
    a = extract_numbers(start_name)
    b = extract_numbers(end_name)
    # a = start_name.split(' ')[0].replace('第', '').replace('章.txt', '').replace('章', '')
    # b = end_name.split(' ')[0].replace('第', '').replace('章.txt', '').replace('章', '')
    
    f = open(str(a)+"-"+str(b)+".txt",'w')
    f.write(union_str)
    f.close()
