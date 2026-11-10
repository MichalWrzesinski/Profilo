from app.worker import celery_app, ping


def test_ping_task_runs_eagerly() -> None:
    assert ping.apply().get() == "pong"
    assert celery_app.conf.task_ignore_result is True
    assert celery_app.conf.worker_redirect_stdouts is False  # JSON logs keep their level
