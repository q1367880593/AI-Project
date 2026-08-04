"""Alert Agent - 高重要性新闻告警推送"""

import json
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import httpx

from storage import Database, Event


class AlertAgent:
    """告警 Agent，当出现高重要性事件时推送通知"""

    THRESHOLD = 90  # 重要性阈值

    def __init__(self, db: Database, threshold: int = 90):
        self.db = db
        self.threshold = threshold

    def check_and_alert(self, person_name: str, events: list[Event]):
        """检查事件并发送告警"""
        high_importance = [e for e in events if e.importance >= self.threshold]
        if not high_importance:
            return

        for event in high_importance:
            news = self.db.get_news_for_event(event.id)
            message = self._format_alert(event, news)

            # 尝试多种推送方式
            self._send_email(event, message)
            self._send_telegram(message)
            self._send_feishu(message)

    def _format_alert(self, event: Event, news) -> str:
        sources = ", ".join(set(n.source for n in news if n.source))
        urls = "\n".join(f"- {n.url}" for n in news[:3] if n.url)

        return f"""【重大新闻告警】

{event.summary[:200]}

重要性: {event.importance}/100
可信度: {event.credibility}%
来源: {sources}

相关链接:
{urls}"""

    def _send_email(self, event: Event, message: str):
        """发送邮件通知"""
        smtp_host = os.getenv("SMTP_HOST", "")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        to_email = os.getenv("ALERT_EMAIL", "")

        if not all([smtp_host, smtp_user, smtp_pass, to_email]):
            return

        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = to_email
            msg["Subject"] = f"[Alert] {event.summary[:50]}..."

            msg.attach(MIMEText(message, "plain", "utf-8"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            print(f"[Alert] 邮件已发送: {event.summary[:50]}...")
        except Exception as e:
            print(f"[Alert] 邮件发送失败: {e}")

    def _send_telegram(self, message: str):
        """发送 Telegram 通知"""
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "")

        if not bot_token or not chat_id:
            return

        try:
            resp = httpx.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown",
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                print("[Alert] Telegram 通知已发送")
            else:
                print(f"[Alert] Telegram 发送失败: {resp.text}")
        except Exception as e:
            print(f"[Alert] Telegram 发送失败: {e}")

    def _send_feishu(self, message: str):
        """发送飞书通知"""
        webhook_url = os.getenv("FEISHU_WEBHOOK_URL", "")

        if not webhook_url:
            return

        try:
            resp = httpx.post(
                webhook_url,
                json={
                    "msg_type": "text",
                    "content": {"text": message},
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                print("[Alert] 飞书通知已发送")
            else:
                print(f"[Alert] 飞书发送失败: {resp.text}")
        except Exception as e:
            print(f"[Alert] 飞书发送失败: {e}")

    def _send_wecom(self, message: str):
        """发送企业微信通知"""
        webhook_url = os.getenv("WECOM_WEBHOOK_URL", "")

        if not webhook_url:
            return

        try:
            resp = httpx.post(
                webhook_url,
                json={
                    "msgtype": "text",
                    "text": {"content": message},
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                print("[Alert] 企业微信通知已发送")
            else:
                print(f"[Alert] 企业微信发送失败: {resp.text}")
        except Exception as e:
            print(f"[Alert] 企业微信发送失败: {e}")