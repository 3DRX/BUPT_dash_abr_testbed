import matplotlib.pyplot as plt

if __name__ == "__main__":
    data = []
    with open('dash_trace.csv', 'r') as f:
        for line in f:
            data.append({
                'start': int(line.split(',')[0]),
                'size': int(line.split(',')[1])
            })
            pass
        pass
    data.sort(key=lambda x: x['start'])
    # delete trace with negative size
    data = [x for x in data if x['size'] > 0]
    # save sorted to file
    with open('dash_trace_sorted.csv', 'w') as f:
        for x in data:
            f.write(str(x['start']) + ',' + str(x['size']) + '\n')
            pass
        pass

    # plot

    # last_time = data[0]['start']
    # index = 0
    # connected = []
    # for i, x in enumerate(data[1:]):
    #     if last_time != x['start'] - 200:
    #         connected.append(data[index:i])
    #         index = i
    #         pass
    #     last_time = x['start']
    #     pass
    # plt.figure()
    # plt.title('Trace')
    # plt.xlabel('Time')
    # plt.ylabel('Size')
    # for x in connected:
    #     plt.plot([i['start'] for i in x], [i['size'] for i in x])
    #     pass
    # plt.show()
    pass