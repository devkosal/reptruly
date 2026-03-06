from ninja_extra.throttling import UserRateThrottle


class UserDefaultBurstThrottle(UserRateThrottle):
    scope = "burst"


class UserDefaultSustainedThrottle(UserRateThrottle):
    scope = "sustained"


class User30PerMinRateThrottle(UserRateThrottle):
    rate = "30/min"
    scope = "minutes"


class User500PerDayRateThrottle(UserRateThrottle):
    rate = "500/day"
    scope = "days"
