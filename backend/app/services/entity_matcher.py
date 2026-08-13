from backend.app.database.neo4j_db import db


class EntityMatcher:

    def find_country(self, name: str):

        query = """
        MATCH (c:Country)
        WHERE toLower(c.name) = toLower($name)
        RETURN c
        """

        return db.execute_query(
            query,
            {"name": name}
        )

    def find_supplier(self, name: str):

        query = """
        MATCH (s:Supplier)
        WHERE toLower(s.name) = toLower($name)
        RETURN s
        """

        return db.execute_query(
            query,
            {"name": name}
        )

    def find_manufacturer(self, name: str):

        query = """
        MATCH (m:Manufacturer)
        WHERE toLower(m.name) = toLower($name)
        RETURN m
        """

        return db.execute_query(
            query,
            {"name": name}
        )

    def find_port(self, name: str):

        query = """
        MATCH (p:Port)
        WHERE toLower(p.name) = toLower($name)
        RETURN p
        """

        return db.execute_query(
            query,
            {"name": name}
        )