+++
title = 'NATS :: Recovering Quorum After Renaming Nodes'
date = 2024-01-20T19:35:31-07:00
draft = false
tags = ["NATS", "Helm", "Kubernetes", "Troubleshooting"]
+++

Occassionally a NATS cluster can lose quorum for various reasons.
Here, we'll look at one specific case, and how to recover from it.

<!--more-->

## Context

In the situation where you try to rename the nodes of the cluster in bulk
(instead of one-by-one),
the cluster will end up configured with double the number of nodes,
with only half of them responding.

For the sake of this article we'll assume the cluster should have 3 nodes,
and, after renaming the nodes, the cluster now expects 6 nodes;
3 with the original names, and 3 with the new names.

Also, the helm release name in this article is `nats-helm-kind`,
which could be simply `nats`, or whatever your release name is.

## Indication of Trouble

### Logs

The first indication of trouble is when you see this `WRN` warning and `INF` message in the logs:

```sh
[WRN] Healthcheck failed: "JetStream has not established contact with a meta leader"
[INF] JetStream cluster no metadata leader
```

### Events

Another indication is that the NATS pods fail to progress to a ready state;
the nats container specifically shows that it's running, but ready == false.

The events will show a warning with the message

```sh
Readiness probe failed: HTTP probe failed with statuscode: 503
```

### NATS CLI

Using the NATS cli, running the `nats server report jetstream` will also show an error.

#### Before Quorum Is Lost

At first, you'll just see half the nodes (with the old name) as being offline:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server report jetstream
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                 JetStream Summary                                                 │
├─────────────────────┬────────────────┬─────────┬───────────┬──────────┬───────┬────────┬──────┬─────────┬─────────┤
│ Server              │ Cluster        │ Streams │ Consumers │ Messages │ Bytes │ Memory │ File │ API Req │ API Err │
├─────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│ x-nats-helm-kind-0  │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-1  │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-2* │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
├─────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│                     │                │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
╰─────────────────────┴────────────────┴─────────┴───────────┴──────────┴───────┴────────┴──────┴─────────┴─────────╯

╭───────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                        RAFT Meta Group Information                                        │
├─────────────────────────────────────────────────────┬──────────┬────────┬─────────┬────────┬────────┬─────┤
│ Name                                                │ ID       │ Leader │ Current │ Online │ Active │ Lag │
├─────────────────────────────────────────────────────┼──────────┼────────┼─────────┼────────┼────────┼─────┤
│ Server name unknown at this time (peerID: Wp0X92Zu) │ Wp0X92Zu │        │ false   │ false  │ 0s     │ 0   │
│ nats-helm-kind-0                                    │ YMpQSy04 │        │ false   │ false  │ 19.53s │ 1   │
│ nats-helm-kind-1                                    │ MGRogjE4 │        │ false   │ false  │ 0s     │ 13  │
│ x-nats-helm-kind-0                                  │ svvjmHnE │        │ true    │ true   │ 526ms  │ 0   │
│ x-nats-helm-kind-1                                  │ XCzEfWSa │        │ true    │ true   │ 525ms  │ 0   │
│ x-nats-helm-kind-2                                  │ XGX0cX6V │ yes    │ true    │ true   │ 0s     │ 0   │
╰─────────────────────────────────────────────────────┴──────────┴────────┴─────────┴────────┴────────┴─────╯

```

#### After Quorum Is Lost

After the quorum is lost, but before the readiness probes cause the nodes to stop responding,
for a brief window of time you'll see the error in the jetstream report:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server report jetstream
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                 JetStream Summary                                                │
├────────────────────┬────────────────┬─────────┬───────────┬──────────┬───────┬────────┬──────┬─────────┬─────────┤
│ Server             │ Cluster        │ Streams │ Consumers │ Messages │ Bytes │ Memory │ File │ API Req │ API Err │
├────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│ x-nats-helm-kind-0 │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-1 │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-2 │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
├────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│                    │                │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
╰────────────────────┴────────────────┴─────────┴───────────┴──────────┴───────┴────────┴──────┴─────────┴─────────╯


WARNING: No cluster meta leader found. The cluster expects 6 nodes but only 3 responded. JetStream operation require at least 4 up nodes.

```

#### After Nodes Stop Responding

Finally, the nodes will possibly stop responding, giving you the general error:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server report jetstream
nats: error: nats: no servers available for connection
command terminated with exit code 1
```

## Recovery

### Regain Quorum

To recover, the cluster must first regain quorum.
In this case the cluster thinks that there are six nodes in the cluster,
so to regain quorum there needs to be a minimum of four nodes reachable from each other.

The way to do this is to add one more node, which will allow quorum to be regained.
You can do this by scaling the stateful set:

```sh
$ kubectl scale --replicas=4 statefulset/nats-helm-kind
```

Which, once complete, should result in quorum being regained:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server report jetstream
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                 JetStream Summary                                                 │
├─────────────────────┬────────────────┬─────────┬───────────┬──────────┬───────┬────────┬──────┬─────────┬─────────┤
│ Server              │ Cluster        │ Streams │ Consumers │ Messages │ Bytes │ Memory │ File │ API Req │ API Err │
├─────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│ x-nats-helm-kind-0  │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-1  │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-2* │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
│ x-nats-helm-kind-3  │ nats-helm-kind │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
├─────────────────────┼────────────────┼─────────┼───────────┼──────────┼───────┼────────┼──────┼─────────┼─────────┤
│                     │                │ 0       │ 0         │ 0        │ 0 B   │ 0 B    │ 0 B  │ 0       │ 0       │
╰─────────────────────┴────────────────┴─────────┴───────────┴──────────┴───────┴────────┴──────┴─────────┴─────────╯

╭───────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                        RAFT Meta Group Information                                        │
├─────────────────────────────────────────────────────┬──────────┬────────┬─────────┬────────┬────────┬─────┤
│ Name                                                │ ID       │ Leader │ Current │ Online │ Active │ Lag │
├─────────────────────────────────────────────────────┼──────────┼────────┼─────────┼────────┼────────┼─────┤
│ Server name unknown at this time (peerID: Wp0X92Zu) │ Wp0X92Zu │        │ false   │ false  │ 0s     │ 0   │
│ nats-helm-kind-0                                    │ YMpQSy04 │        │ false   │ false  │ 47m27s │ 6   │
│ nats-helm-kind-1                                    │ MGRogjE4 │        │ false   │ false  │ 0s     │ 18  │
│ x-nats-helm-kind-0                                  │ svvjmHnE │        │ true    │ true   │ 461ms  │ 0   │
│ x-nats-helm-kind-1                                  │ XCzEfWSa │        │ true    │ true   │ 461ms  │ 0   │
│ x-nats-helm-kind-2                                  │ XGX0cX6V │ yes    │ true    │ true   │ 0s     │ 0   │
│ x-nats-helm-kind-3                                  │ G7oD67bf │        │ true    │ true   │ 461ms  │ 0   │
╰─────────────────────────────────────────────────────┴──────────┴────────┴─────────┴────────┴────────┴─────╯

```

### Remove Offline/Old Nodes

You can do this either with the CLI, or using NATS directly.

#### CLI

Now you can remove the old node names, one by one, using the NATS cli:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server cluster peer-remove -f <peer ID>
```

#### Using NATS Directly

You can also remove a peer directly by publishing to the JetStream API subjects:

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats publish '$JS.API.SERVER.REMOVE' '{"peer":"","peer_id":"YMpQSy04"}'
```

Which will send a response message on the same channel that confirms the action:

```json
{
  "type": "io.nats.jetstream.api.v1.meta_server_remove_response",
  "success": true
}
```

### Remove Temporarily Added Server

#### Scale Back Down To 3 Servers

Now that the number of nodes is now 4 instead of 6, it's now safe to scale back down to 3 nodes,
and then remove the node we temporarily added.

```sh
$ kubectl scale --replicas=3 statefulset/nats-helm-kind
```

#### Remove Peer

```sh
$ kubectl exec -it deployment/nats-helm-kind-box -- nats server cluster peer-remove -f G7oD67bf
```

### Success!

Finally, the state of the cluster should be restored now, with three nodes.
