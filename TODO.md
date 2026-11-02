There is an issue with trolley schedules. See this conversation with the agent in response to "file:///Users/rhoen/Documents/code/magnus-bus/info.html?stop=22151" not returning any data for the trolleys. 

SEPTA’s stop-schedule response is a collection of timetable entries, not simply “departures running today.” It includes different schedule versions and service calendars—such as different operating days or special service.

The app currently decides which entries apply by looking at active trolley trips:
1. Today’s active T2 trips identify schedule version 20261101, service calendar 46.
2. At City Hall, the timetable contains entries matching that combination, so upcoming departures appear.
3. At Spruce & 42nd, the timetable contains entries for other service calendars, but none matching 46. The app excludes them to avoid presenting an unverified timetable as today’s service.
I found the same pattern for T3, T4, and T5. Their active trips also did not include stop 22151.

There’s a limitation in our approach: an active trip proves that its calendar runs today, but doesn’t prove that every other calendar is inactive. A valid service starting later could be filtered out because it has no active trip yet. So “no matching schedule” is not conclusive proof of no service.

The page also lists routes from the broader stop directory without explaining that distinction. That makes empty trolley panels look like a data failure. The more reliable solution is to check SEPTA’s actual calendar dates and exceptions, and distinguish “not scheduled today” from “schedule could not be verified.”