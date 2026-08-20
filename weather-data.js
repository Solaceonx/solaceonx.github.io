window.WEATHER_DATA = {
  "updatedAt": "2026-08-20T11:05:00-07:00",
  "station": "KLAX",
  "snapshots": [
    {
      "id": "2026-08-20T11:05:00-07:00",
      "eventDate": "2026-08-20",
      "observedAt": "2026-08-20T11:05:00-07:00",
      "station": "KLAX",
      "currentHighF": 75,
      "predictedMeanF": 77.1,
      "predictedMedianF": 77,
      "distribution": [
        {
          "label": "75",
          "temperatureF": 75,
          "probability": 0.14567
        },
        {
          "label": "76",
          "temperatureF": 76,
          "probability": 0.23429
        },
        {
          "label": "77",
          "temperatureF": 77,
          "probability": 0.27025
        },
        {
          "label": "78",
          "temperatureF": 78,
          "probability": 0.21075
        },
        {
          "label": "79",
          "temperatureF": 79,
          "probability": 0.08552
        },
        {
          "label": "80",
          "temperatureF": 80,
          "probability": 0.03033
        },
        {
          "label": "81",
          "temperatureF": 81,
          "probability": 0.00831
        },
        {
          "label": "82",
          "temperatureF": 82,
          "probability": 0.00436
        },
        {
          "label": "83",
          "temperatureF": 83,
          "probability": 0.00479
        },
        {
          "label": "84+",
          "temperatureF": 84,
          "probability": 0.00573
        }
      ],
      "thresholds": [
        {
          "strike": 76,
          "modelProbability": 0.62004,
          "marketMidpoint": 0.915
        },
        {
          "strike": 77,
          "modelProbability": 0.34979,
          "marketMidpoint": 0.685,
          "yesAsk": 0.74,
          "yesBid": 0.7
        },
        {
          "strike": 78,
          "modelProbability": 0.13904,
          "marketMidpoint": 0.335,
          "yesAsk": 0.36
        },
        {
          "strike": 79,
          "modelProbability": 0.05352,
          "marketMidpoint": 0.115,
          "yesAsk": 0.16
        },
        {
          "strike": 80,
          "modelProbability": 0.02319,
          "marketMidpoint": 0.035,
          "yesAsk": 0.05
        },
        {
          "strike": 81,
          "modelProbability": 0.01488,
          "marketMidpoint": null,
          "yesAsk": 0.04
        },
        {
          "strike": 82,
          "modelProbability": 0.01052,
          "marketMidpoint": 0.025,
          "yesAsk": 0.03
        }
      ],
      "position": {
        "contract": "YES >77°F",
        "quantity": 5,
        "entryPrice": 0.95,
        "filledNotional": 4.75,
        "fees": 0.08,
        "totalCost": 4.83,
        "sellBid": 0.7,
        "estimatedExitNet": 3.4,
        "status": "open"
      },
      "recommendation": {
        "action": "Sell / do not add",
        "confidence": "Low–moderate",
        "breakEvenProbability": 0.68,
        "note": "The model values five contracts near $1.75, below the estimated $3.40 net exit value. Even a favorable +1°F forecast shift only raises P(>77) to about 62%."
      },
      "outcome": null,
      "notes": "First live tracked position. Market prices transcribed from Robinhood around 10:56–11:05 PT."
    }
  ]
};
