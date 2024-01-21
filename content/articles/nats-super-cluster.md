+++
title = 'NATS :: Super Cluster'
date = 2024-01-20T22:41:56-07:00
draft = true
tags = ["NATS", "Super Cluster"]
+++

# Super Cluster

A "Super Cluster" in NATS is created by connecting more than one NATS Cluster together through NATS Gateways.

<!--more-->

In a Super Cluster, a client connected to any node in any of the member
clusters is able to subscribe to a subject and will receive messages
that are published to that subject from any other node in any other member cluster.
