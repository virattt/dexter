export function snakeCase(str: string) {
    return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}
