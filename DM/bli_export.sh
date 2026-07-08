#!/bin/bash

# 检查是否提供了参数
if [ $# -ne 1 ]; then
    echo "用法: ./run_bili.sh <路径>"
    exit 1
fi

# 获取传递给脚本的参数
path=$1

echo $path
# 调用 Python 脚本并传递参数
python3 bili.py "$path"
cd $path
# 原格式导出
# ffmpeg -i a.mp4 -i b.mp3 -c:v copy -c:a aac c.mp4
# 压制导出
ffmpeg -i a.mp4 -i b.mp3 -c:v libx265 -crf 28 -preset medium -c:a aac -movflags +faststart -tag:v hvc1 c.mp4


python3 make_nfo_poster.py

python3 convert_dm_to_ass.py



rm a.mp4
rm b.mp3