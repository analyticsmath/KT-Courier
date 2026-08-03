# Storefront store pages

Store documents expose only name, slug, safe description/media references,
categories, fulfilment modes and offer count. Owner, contacts, private addresses,
bank data, private schedules and performance data are not projected. There is no
authoritative public schedule model, so pages report `HOURS_UNAVAILABLE`. They
never emit `OPEN`, `CLOSED`, structured opening hours, or an order-acceptance
promise until authoritative public schedule evidence is approved.
