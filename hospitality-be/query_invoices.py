from app.db.session import engine
from sqlmodel import Session, text

with Session(engine) as session:
    res = session.execute(text("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE contype = 'f' AND pg_get_constraintdef(c.oid) LIKE '%invoice_lines%';")).fetchall()
    for r in res:
        print(r)
