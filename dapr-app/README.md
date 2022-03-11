# Tiered App

## Needed
- [X] Example of working solution; API -> Storage
- [ ] Language to describe wiring (yml)
- [ ] UI for wiring
- [X] K8s for runtime
- [ ] Logging (Dapr)
- [ ] Canary/Blue-Green deployments

## Basic
```
minikube start
minikube dashboard
```

## Test with Data
```
dapr invoke --app-id mvpval --method thing --data-file sample.json
```

## API: Validation
```
dapr run --app-id mvpval --app-port 3000 node app.js
```

## Persistence
```
dapr run --app-id mvpstate --app-port 3001 node app.js
```