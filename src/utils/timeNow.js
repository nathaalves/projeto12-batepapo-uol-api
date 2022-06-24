import dayjs from "dayjs";

export default function timeNow () {

    function formatTime (time) {

        if (time < 10) {
            return "0" + time
        }

        return time
    }

    const hour = formatTime(dayjs().hour());
    const minutes = formatTime(dayjs().minute());
    const seconds = formatTime(dayjs().second())

    return `${hour}:${minutes}:${seconds}`
}