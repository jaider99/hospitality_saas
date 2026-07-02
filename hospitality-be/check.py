from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

engine = create_engine('postgresql://postgres:postgres@localhost:5432/hospitality')
Session = sessionmaker(bind=engine)
with Session() as s:
    res = s.execute(text("SELECT id, document_number, is_duplicate FROM invoices WHERE document_number = 'A26-004800'"))
    for row in res:
        print(row)
