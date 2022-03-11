# Tiered App

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