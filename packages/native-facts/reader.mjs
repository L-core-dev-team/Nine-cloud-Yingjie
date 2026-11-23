// In-process research authority. Only host bootstrap installs a repository;
 // public request JSON never supplies a function, principal or state snapshot.
const readers = new WeakMap();
export function openSyntheticReader(repository, core, owner, save, through) {
    if (!Number.isSafeInteger(through) || through < 0) throw Error("invalid-read-horizon");
    const token=Object.freeze({});
    readers.set(token,{repository,core,owner,save,through});
    return token;
}
export function readHistorical(token, ref) {
    const session=readers.get(token);
    if (!session) throw Error("untrusted-reader");
    if (!ref || ref.save!==session.save || ref.branch!=="root" || !Number.isSafeInteger(ref.r) ||
        ref.r<0 || ref.r>session.through || typeof ref.key!=="string") throw Error("outside-read-scope");
    const record=session.repository.read(session.owner,session.save,ref.key,ref.r);
    if (!record || record.owner!==session.owner || record.save!==session.save || record.key!==ref.key ||
        record.visible!==true || record.availableAt>ref.r || !Number.isSafeInteger(record.availableAt))
        throw Error("historical-read-unavailable");
    return {record,owner:session.owner,core:session.core};
}
