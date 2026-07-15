"""Tool definitions shared across the preserved tool library."""

FILE_TOOLS = [
    {
        "name": "read_file",
        "description": "Read the contents of a file at the given path.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute or project-relative file path"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating parent directories as needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute or project-relative file path"},
                "content": {"type": "string", "description": "File content to write"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "list_files",
        "description": "List files in a directory, optionally filtered by extension.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Directory path to list"},
                "extensions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "File extensions to filter, e.g. [\".m\", \".h\", \".swift\"]. Empty means all files."
                }
            },
            "required": ["directory"]
        }
    },
    {
        "name": "search_files",
        "description": "Search for a pattern in files under a directory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Text or regex pattern to search for"},
                "directory": {"type": "string", "description": "Directory to search in"},
                "extensions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Limit search to these file extensions"
                }
            },
            "required": ["pattern", "directory"]
        }
    }
]

XCODE_TOOLS = [
    {
        "name": "run_xcodebuild",
        "description": "Run an xcodebuild command and return its output.",
        "input_schema": {
            "type": "object",
            "properties": {
                "args": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "xcodebuild arguments list, e.g. [\"-scheme\", \"MyApp\", \"build\"]"
                },
                "working_directory": {
                    "type": "string",
                    "description": "Directory to run xcodebuild from"
                }
            },
            "required": ["args"]
        }
    }
]
