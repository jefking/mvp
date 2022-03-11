# Tiered App

## Needed
1. [X] Example of working solution; API -> Storage
2. [ ] Language to describe wiring (yml)
3. [ ] UI for wiring
4. [X] K8s for runtime
5. [ ] Logging (Dapr)
6. [ ] Canary/Blue-Green deployments

## Test with Data
```
dapr invoke --app-id mvpval --method newthing --data-file sample.json
```

## API: Validation
```
dapr run --app-id mvpval --app-port 3000 node app.js
```

## Persistence
```
dapr run --app-id mvpstate --app-port 3001 node app.js
```