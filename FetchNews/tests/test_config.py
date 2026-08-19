import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fetch_news.config import ConfigError, ensure_env, load_dotenv


class DotenvTests(unittest.TestCase):
    def test_loads_values_without_overriding_environment(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / ".env"
            path.write_text(
                "# comment\n"
                "OPENAI_API_KEY=from-file\n"
                "export QUOTED_VALUE=\"hello world\"\n"
                "INLINE_COMMENT=value # comment\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"OPENAI_API_KEY": "from-system"}, clear=True):
                self.assertTrue(load_dotenv(path))
                self.assertEqual(os.environ["OPENAI_API_KEY"], "from-system")
                self.assertEqual(os.environ["QUOTED_VALUE"], "hello world")
                self.assertEqual(os.environ["INLINE_COMMENT"], "value")

    def test_reports_invalid_line(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / ".env"
            path.write_text("INVALID LINE\n", encoding="utf-8")
            with self.assertRaisesRegex(ConfigError, "缺少等号"):
                load_dotenv(path)

    def test_ensure_env_never_overwrites_existing_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / ".env.example"
            destination = root / ".env"
            source.write_text("OPENAI_API_KEY=\n", encoding="utf-8")
            self.assertTrue(ensure_env(destination, source))
            destination.write_text("OPENAI_API_KEY=secret\n", encoding="utf-8")
            self.assertFalse(ensure_env(destination, source))
            self.assertEqual(destination.read_text(encoding="utf-8"), "OPENAI_API_KEY=secret\n")


if __name__ == "__main__":
    unittest.main()
