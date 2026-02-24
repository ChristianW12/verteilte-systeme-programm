# Verteiltes Aufgaben- und Projektmanagementsystem

## Zielsetzung

Im Rahmen des Moduls **Verteilte Systeme** wird eine webbasierte Anwendung zur Aufgaben- und Projektverwaltung entwickelt.  
Ziel des Projekts ist es, zentrale Konzepte verteilter Systeme wie horizontale Skalierbarkeit, Lastverteilung und Ausfallsicherheit praxisnah umzusetzen und demonstrierbar zu machen.

## Projektidee

Die Anwendung orientiert sich funktional an etablierten Projektmanagement-Tools wie Jira und stellt grundlegende Features zur Organisation und Verwaltung von Projekten und Aufgaben bereit.  
Der Fokus liegt dabei nicht auf einem vollständigen Funktionsumfang, sondern auf einer technisch sauberen und skalierbaren Architektur.

## Funktionale Anforderungen

Die Anwendung soll folgende Kernfunktionen bereitstellen:

- Verwaltung von Projekten  
- Erstellung und Bearbeitung von Tickets (Issues)  
- Status-Workflow (z. B. To Do, In Progress, Done)  
- Priorisierung von Aufgaben  
- Benutzer- und Rollenverwaltung  
- Zuweisung von Tickets zu Nutzern  
- Kommentarfunktion pro Ticket  
- Verwaltung von Deadlines  

## Technisches Konzept

Die Anwendung basiert auf einer containerisierten Architektur unter Verwendung von Docker.

Geplante Struktur:

- Angular-Frontend zur Benutzerinteraktion  
- Express-Backend als REST-API  
- Relationale Datenbank zur persistenten Speicherung  
- Mehrere Backend-Instanzen zur Demonstration horizontaler Skalierung  
- Load Balancer zur Verteilung eingehender Anfragen  

Durch diese Architektur wird demonstriert, wie mehrere Backend-Instanzen parallel betrieben werden können und wie das System bei Ausfall einzelner Instanzen weiterhin funktionsfähig bleibt.

## Projektschwerpunkt

Der Fokus des Projekts liegt insbesondere auf:

- Trennung von Zuständigkeiten (Separation of Concerns)  
- Zustandslosen Services (Stateless Design)  
- Lastverteilung  
- Fehlertoleranz  

Die Anwendung dient als praxisnahes Demonstrationssystem zur Veranschaulichung zentraler Konzepte verteilter Systeme.
