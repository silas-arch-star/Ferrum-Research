from backend.app.config import Settings


import pytest
from pydantic import ValidationError

from backend.app import config


def test_default_settings():
    settings = Settings()

    assert settings.app_name == "Ferrum"
    assert settings.app_env == "development"
    assert settings.api_prefix == "/api/v1"


@pytest.fixture
def isolated_debug(monkeypatch, tmp_path):
    monkeypatch.delenv("FERRUM_DEBUG", raising=False)
    env_file = tmp_path / ".env"
    monkeypatch.setattr(config, "ENV_FILE", env_file)
    return env_file


def test_unrelated_shell_debug_does_not_prevent_startup(monkeypatch, isolated_debug):
    monkeypatch.setenv("DEBUG", "release")

    assert Settings(_env_file=None).debug is True


@pytest.mark.parametrize("value, expected", [("true", True), ("false", False)])
def test_namespaced_debug_environment_is_honored(monkeypatch, isolated_debug, value, expected):
    monkeypatch.setenv("DEBUG", "release")
    monkeypatch.setenv("FERRUM_DEBUG", value)

    assert Settings(_env_file=None).debug is expected


def test_invalid_namespaced_debug_is_rejected(monkeypatch, isolated_debug):
    monkeypatch.setenv("FERRUM_DEBUG", "release")

    with pytest.raises(ValidationError, match="FERRUM_DEBUG"):
        Settings(_env_file=None)


@pytest.mark.parametrize("value, expected", [("true", True), ("false", False)])
def test_project_local_legacy_debug_remains_supported(monkeypatch, isolated_debug, value, expected):
    monkeypatch.setenv("DEBUG", "release")
    isolated_debug.write_text(f"DEBUG={value}\n", encoding="utf-8")

    assert Settings(_env_file=isolated_debug).debug is expected


def test_namespaced_debug_overrides_legacy_project_setting(monkeypatch, isolated_debug):
    isolated_debug.write_text("DEBUG=false\n", encoding="utf-8")
    monkeypatch.setenv("FERRUM_DEBUG", "true")

    assert Settings(_env_file=isolated_debug).debug is True


def test_namespaced_debug_can_be_set_in_project_env_file(isolated_debug):
    isolated_debug.write_text("FERRUM_DEBUG=false\n", encoding="utf-8")

    assert Settings(_env_file=isolated_debug).debug is False
