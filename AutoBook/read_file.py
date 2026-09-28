#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
持续按回车读取qyn_2.txt的下一行内容并输出
使用.line_marker.txt文件记录当前行数
每行之间随机输出终端日志，带颜色输出
支持方向键和空格键交互（实时响应，无需回车）
"""

import os
import random
import time
import sys
import tty
import termios
from datetime import datetime
import subprocess


MARKER_FILE = '.line_marker.txt'
TEXT_FILE = 'a.txt'

# ANSI颜色代码
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    GRAY = '\033[90m'

# 常见的终端日志模板（更详细的版本）
LOG_TEMPLATES = [
    ("[INFO]", Colors.BLUE, "Processing incoming HTTP request from client {ip} on endpoint {endpoint}"),
    ("[DEBUG]", Colors.GRAY, "Establishing database connection to PostgreSQL server at localhost:{port} with user '{user}'"),
    ("[INFO]", Colors.GREEN, "Successfully loaded configuration from {file} - {count} parameters initialized"),
    ("[DEBUG]", Colors.GRAY, "Initializing module: {module} - loading dependencies and setting up environment"),
    ("[INFO]", Colors.BLUE, "Starting {service} service on port {port} - listening for incoming connections"),
    ("[DEBUG]", Colors.GRAY, "Cache hit for key: {key} - retrieved {size}KB of data in {time}ms"),
    ("[INFO]", Colors.GREEN, "Request completed successfully - processed in {time}ms with status code {status}"),
    ("[DEBUG]", Colors.GRAY, "Current memory usage: {memory}MB - heap size: {heap}MB, used: {used}%"),
    ("[INFO]", Colors.GREEN, "TCP connection established successfully with remote host {ip}:{port}"),
    ("[DEBUG]", Colors.GRAY, "Executing SQL query on table '{table}': SELECT * FROM {table} WHERE id > {count} LIMIT 100"),
    ("[INFO]", Colors.BLUE, "HTTP Response sent to client - status: {status}, content-type: application/json, size: {size}KB"),
    ("[DEBUG]", Colors.GRAY, "Parsing JSON payload from request body - {count} fields detected, validating schema"),
    ("[INFO]", Colors.GREEN, "Authentication successful for user: {user} - session token generated, expires in {time}s"),
    ("[DEBUG]", Colors.GRAY, "Reading configuration file: {file} - parsing {count} lines of YAML/JSON data"),
    ("[INFO]", Colors.BLUE, "Background task '{task}' completed successfully - processed {count} items in {time}ms"),
    ("[DEBUG]", Colors.GRAY, "Validating input parameters for function call - checking {count} required fields"),
    ("[INFO]", Colors.GREEN, "Server health check passed - all {count} services responding, uptime: {uptime} hours"),
    ("[DEBUG]", Colors.GRAY, "Loading runtime dependencies - {count} modules imported, initialization time: {time}ms"),
    ("[INFO]", Colors.BLUE, "RESTful API call to {endpoint} completed - response received in {time}ms"),
    ("[DEBUG]", Colors.GRAY, "Cleanup process started - releasing {count} resources and closing {connections} connections"),
    ("[WARNING]", Colors.YELLOW, "High memory usage detected: {memory}MB ({used}% of total) - consider optimization"),
    ("[INFO]", Colors.GREEN, "WebSocket connection established with client {ip} - protocol version {version}"),
    ("[DEBUG]", Colors.GRAY, "Redis cache miss for key '{key}' - fetching from primary database and caching result"),
    ("[INFO]", Colors.BLUE, "File upload received: {file} - size: {size}KB, type: {type}, saving to storage"),
    ("[DEBUG]", Colors.GRAY, "Message queue consumer processing {count} pending messages from topic '{topic}'"),
    ("[SUCCESS]", Colors.GREEN, "Deployment completed successfully - {count} services updated, {connections} instances restarted"),
    ("[ERROR]", Colors.RED, "Connection timeout while attempting to reach database server at {ip}:{port} - retrying in {time}s"),
    ("[INFO]", Colors.CYAN, "Scheduled job '{task}' triggered at {timestamp} - executing background processing"),
    ("[DEBUG]", Colors.GRAY, "Transaction {transaction_id} committed successfully - {count} records updated in {time}ms"),
    ("[INFO]", Colors.BLUE, "Load balancer distributing traffic across {count} backend servers - current load: {used}%"),
]

# 随机参数生成
IPS = ["192.168.1.100", "10.0.0.45", "172.16.0.23", "127.0.0.1"]
MODULES = ["auth_service", "database_connector", "cache_manager", "api_gateway", "utils_handler", "core_engine", "request_handler"]
PORTS = [3000, 8080, 5432, 6379, 27017, 9000, 3306, 9200]
KEYS = ["user:123:session", "cache:product:456", "data:analytics:xyz", "session:token:789"]
TIMES = [12, 25, 45, 67, 89, 123, 234, 456, 678, 891]
MEMORY = [128, 256, 512, 1024, 2048, 4096]
HEAP = [64, 128, 256, 512, 1024]
USED = [45, 67, 72, 85, 91]
STATUS = [200, 201, 204, 301, 304, 404]
USERS = ["admin", "user001", "guest_user", "system_service", "api_client"]
FILES = ["config.json", "app_settings.yaml", "database.ini", "application.properties", ".env.production"]
TABLES = ["users", "products", "orders", "sessions", "transactions", "logs"]
ENDPOINTS = ["/api/v1/users", "/api/v1/posts", "/health", "/metrics", "/api/v2/analytics", "/webhook/notify"]
SERVICES = ["API Gateway", "Auth Service", "Database Proxy", "Message Queue", "Redis Cache"]
TASKS = ["data_sync_job", "backup_task", "cleanup_worker", "report_generator", "email_processor"]
COUNTS = [5, 10, 15, 23, 42, 67, 100, 150, 250]
SIZES = [12, 34, 56, 128, 256, 512, 1024]
TYPES = ["application/json", "image/jpeg", "text/csv", "application/pdf"]
UPTIMES = [12, 24, 48, 72, 168, 336]
VERSIONS = ["1.0", "1.1", "2.0", "13"]
TOPICS = ["user_events", "order_processing", "notification_queue", "analytics_stream"]
TRANSACTION_IDS = ["tx_" + str(random.randint(100000, 999999)) for _ in range(10)]
CONNECTIONS = [2, 3, 4, 5, 8, 10, 12]

def generate_random_log():
    """生成随机的终端日志，带颜色"""
    level, color, template = random.choice(LOG_TEMPLATES)

    # 替换模板中的变量
    log = template.format(
        ip=random.choice(IPS),
        module=random.choice(MODULES),
        port=random.choice(PORTS),
        key=random.choice(KEYS),
        time=random.choice(TIMES),
        memory=random.choice(MEMORY),
        heap=random.choice(HEAP),
        used=random.choice(USED),
        status=random.choice(STATUS),
        user=random.choice(USERS),
        file=random.choice(FILES),
        table=random.choice(TABLES),
        endpoint=random.choice(ENDPOINTS),
        service=random.choice(SERVICES),
        task=random.choice(TASKS),
        count=random.choice(COUNTS),
        size=random.choice(SIZES),
        type=random.choice(TYPES),
        uptime=random.choice(UPTIMES),
        version=random.choice(VERSIONS),
        topic=random.choice(TOPICS),
        transaction_id=random.choice(TRANSACTION_IDS),
        connections=random.choice(CONNECTIONS),
        timestamp=datetime.now().strftime("%H:%M:%S")
    )

    # 添加时间戳
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    # 返回带颜色的日志
    return f"{Colors.GRAY}[{timestamp}]{Colors.RESET} {color}{level}{Colors.RESET} {log}"

def print_random_logs(count=None):
    """打印随机数量的日志（4-6条）"""
    if count is None:
        count = random.randint(4, 6)

    for _ in range(count):
        print(generate_random_log())
        time.sleep(0.03)  # 稍微延迟，模拟真实日志输出

def get_current_line_number():
    """从标记文件读取当前行号"""
    if os.path.exists(MARKER_FILE):
        try:
            with open(MARKER_FILE, 'r') as f:
                return int(f.read().strip())
        except:
            return 1
    return 1

def save_line_number(line_number):
    """保存行号到标记文件"""
    with open(MARKER_FILE, 'w') as f:
        f.write(str(line_number))

p = None
def display_line(lines, line_num, total_lines):
    """显示指定行，带日志输出"""
    if 1 <= line_num <= total_lines:
        # 输出随机日志
        print_random_logs()
        print()
        global p
        if p != None:
            p.terminate()
        # 输出当前行
        line = lines[line_num - 1]
        print(f"number. {line_num}  \n {line}", end='')
        # subprocess.run(["say","-r", "200", line])
        line = line.replace("“", "").replace("”", "").replace("《", "").replace("》", "")
        p = subprocess.Popen(["say", "-r", "200", line])
        
        print()  # 额外的换行使输出更清晰
    else:
        if line_num < 1:
            print(f"{Colors.YELLOW}已经是第一行了{Colors.RESET}")
        else:
            print(f"{Colors.YELLOW}已经是最后一行了{Colors.RESET}")

def getch():
    """读取单个字符，无需回车（支持方向键）"""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)

        # 如果是转义字符，读取完整的转义序列
        if ch == '\x1b':  # ESC
            ch += sys.stdin.read(2)  # 读取 [ 和方向键代码

        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

def parse_key(key):
    """解析按键，返回动作类型"""
    # 方向键转义序列
    if key == '\x1b[A':  # 上箭头
        return 'prev'
    elif key == '\x1b[B':  # 下箭头
        return 'next'
    elif key == '\x1b[C':  # 右箭头
        return 'next'
    elif key == '\x1b[D':  # 左箭头
        return 'prev'

    # 回车键
    elif key == '\r' or key == '\n':
        return 'next'

    # 空格键
    elif key == ' ':
        return 'next'

    # 字母命令
    elif key.lower() == 'q':
        return 'quit'
    elif key.lower() == 'r':
        return 'reset'
    elif key.lower() in ['j', 'n', 'd']:  # j=vim下, n=next, d=down
        return 'next'
    elif key.lower() in ['k', 'u']:  # k=vim上, u=up
        return 'prev'

    # Ctrl+C
    elif key == '\x03':
        return 'quit'

    else:
        return 'unknown'

def main():
    try:
        # 读取文件的所有行
        with open(TEXT_FILE, 'r', encoding='utf-8') as file:
            lines = file.readlines()

        total_lines = len(lines)
        print(f"{Colors.CYAN}{Colors.BOLD}文件共有 {total_lines} 行{Colors.RESET}")
        print(f"{Colors.YELLOW}交互说明（无需回车，直接生效）：{Colors.RESET}")
        print(f"  - {Colors.GREEN}回车 / 空格 / ↓ / → / j{Colors.RESET} : 下一行")
        print(f"  - {Colors.GREEN}↑ / ← / k{Colors.RESET} : 上一行")
        print(f"  - {Colors.GREEN}'q'{Colors.RESET} : 退出")
        print(f"  - {Colors.GREEN}'r'{Colors.RESET} : 重置到第一行")
        print()

        # 启动时输出一些日志
        print_random_logs(3)
        print()

        # 获取当前应该读取的行号
        current_line = get_current_line_number()

        # 标记是否是第一次显示
        first_display = True

        while True:
            # 确保行号在有效范围内
            if current_line < 1:
                current_line = 1
            elif current_line > total_lines:
                current_line = total_lines

            # 显示当前行
            if first_display or current_line <= total_lines:
                display_line(lines, current_line, total_lines)
                save_line_number(current_line)
                first_display = False

            # 等待用户按键（无需回车）
            try:
                key = getch()
            except Exception as e:
                print(f"\n{Colors.RED}读取按键错误: {e}{Colors.RESET}")
                break

            # 解析按键
            action = parse_key(key)

            if action == 'quit':
                print()
                print_random_logs(2)
                print(f"{Colors.GREEN}退出程序{Colors.RESET}")
                break

            elif action == 'reset':
                current_line = 1
                save_line_number(current_line)
                print()
                print_random_logs(2)
                print(f"{Colors.CYAN}已重置到第一行{Colors.RESET}\n")

            elif action == 'next':
                if current_line < total_lines:
                    current_line += 1
                else:
                    print(f"{Colors.YELLOW}已经是最后一行了（共 {total_lines} 行）{Colors.RESET}")
                    print(f"{Colors.YELLOW}按 'r' 重新开始，或 'q' 退出{Colors.RESET}\n")

            elif action == 'prev':
                if current_line > 1:
                    current_line -= 1
                else:
                    print(f"{Colors.YELLOW}已经是第一行了{Colors.RESET}\n")

            elif action == 'unknown':
                # 静默忽略未知按键，不显示错误消息
                pass

    except FileNotFoundError:
        print(f"{Colors.RED}错误：找不到文件 {TEXT_FILE}{Colors.RESET}")
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}程序被中断，退出{Colors.RESET}")
    except Exception as e:
        print(f"{Colors.RED}错误：{e}{Colors.RESET}")

if __name__ == "__main__":
    main()
