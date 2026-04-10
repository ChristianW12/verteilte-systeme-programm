# Systemarchitektur

Dieses Diagramm zeigt die Interaktion der verschiedenen Services in deinem Projekt.

```mermaid
flowchart TD
    subgraph Client ["Client-Ebene"]
        Frontend[Angular Frontend]
    end

    subgraph Proxy ["Infrastruktur + Loadbalancer"]
        Nginx[Nginx Reverse Proxy]
    end

    subgraph App ["Anwendungs-Ebene"]
        Backend[Express Backend Instanzen]
        WS[WebSocket Service]
    end

    subgraph Data ["Daten-Ebene"]
        DB[(PostgreSQL DB)]
        Redis[[Redis Locks & Pub/Sub]]
    end

    %% Verbindungen
    Frontend -- "HTTP / WS" --> Nginx
    
    Nginx -- "/api/" --> Backend
    Nginx -- "/ws/" --> WS

    Backend -- "SQL" --> DB
    Backend -- "Lock/Publish" --> Redis

    Redis -- "Subscribe" --> WS
    WS -. "Broadcast Events" .-> Frontend

    style Frontend fill:#f9f,stroke:#333,stroke-width:2px
    style Nginx fill:#bbf,stroke:#333,stroke-width:2px
    style Backend fill:#dfd,stroke:#333,stroke-width:2px
    style WS fill:#fdd,stroke:#333,stroke-width:2px
    style DB fill:#fff,stroke:#333,stroke-width:2px
    style Redis fill:#eee,stroke:#333,stroke-width:2px
```

## Komponentenübersicht

1. **Angular Frontend**: Benutzeroberfläche.
2. **Nginx Reverse Proxy**: Verteilt Anfragen (Load Balancing & Routing).
3. **Express Backend**: Verarbeitet die Business-Logik und Datenzugriffe.
4. **WebSocket Service**: Sendet Echtzeit-Updates an die Clients.
5. **Redis**: Zentraler Speicher für Task-Sperren und Nachrichten-Bus.
6. **PostgreSQL**: Permanente Datenspeicherung.
