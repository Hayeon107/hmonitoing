import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# backend 폴더의 상위 폴더에 있는 .env를 지정
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def test_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return result.scalar_one()
    
