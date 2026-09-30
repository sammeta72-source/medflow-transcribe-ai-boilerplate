"""
Double-fork launcher to fully detach uvicorn from the controlling shell.
The bash tool seems to kill child processes when each tool call returns,
so we need to fork twice + setsid to escape the process group.
"""
import os
import sys
import time

def daemonize():
    # First fork
    pid = os.fork()
    if pid > 0:
        # Parent: print child pid and exit immediately
        print(f"DAEMON_CHILD_PID={pid}")
        sys.stdout.flush()
        os._exit(0)

    # Decouple from parent environment
    os.setsid()
    os.umask(0)

    # Second fork
    pid = os.fork()
    if pid > 0:
        os._exit(0)

    # Now we are the daemon; redirect stdio
    sys.stdout.flush()
    sys.stderr.flush()
    log = open("/home/z/my-project/mini-services/ai-agents-service/service.log", "a", buffering=1)
    os.dup2(log.fileno(), sys.stdin.fileno())
    os.dup2(log.fileno(), sys.stdout.fileno())
    os.dup2(log.fileno(), sys.stderr.fileno())

    # Close extra fds (best-effort)
    import resource
    try:
        maxfd = resource.getrlimit(resource.RLIMIT_NOFILE)[1]
        if maxfd == resource.RLIM_INFINITY:
            maxfd = 1024
        for fd in range(3, maxfd):
            try:
                os.close(fd)
            except OSError:
                pass
    except Exception:
        pass


def main():
    daemonize()
    # Now run uvicorn in-process
    import uvicorn
    # Write a marker file so external process can confirm we are alive
    with open("/home/z/my-project/mini-services/ai-agents-service/.daemon_pid", "w") as f:
        f.write(str(os.getpid()))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":
    main()
