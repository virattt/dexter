from dexter.utils.ui import UI


class Logger:
    """Logger that uses the new interactive UI system."""
    
    def __init__(self):
        self.ui = UI()
        self.log = []

    def _log(self, msg: str):
        """Print immediately and keep in log."""
        print(msg, flush=True)
        self.log.append(msg)

    def log_header(self, msg: str):
        self.ui.print_header(msg)
    
    def log_user_query(self, query: str):
        self.ui.print_user_query(query)

    def log_task_list(self, tasks):
        self.ui.print_task_list(tasks)

    def log_task_start(self, task_desc: str):
        self.ui.print_task_start(task_desc)

    def log_task_done(self, task_desc: str):
        self.ui.print_task_done(task_desc)

    def log_tool_run(self, tool: str, result: str = ""):
        self.ui.print_tool_run(tool, str(result)[:100])

    def log_risky(self, tool: str, input_str: str):
        self.ui.print_warning(f"Risky action {tool}({input_str}) — auto-confirmed")

    def log_summary(self, summary: str):
        self.ui.print_answer(summary)
    
    def progress(self, message: str, success_message: str = ""):
        """Return a progress context manager for showing loading states."""
        return self.ui.progress(message, success_message)
